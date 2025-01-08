import { ElementHandle, Page } from "puppeteer";
import * as puppeteer from "puppeteer";
import { FormDetails } from "../types/booking";

export class PuppeteerService {
  private page: Page | null = null;
  private browser: puppeteer.Browser | null = null;
  private activeResources: Set<string> = new Set();

  async initBrowser() {
    try {
      console.log("Starting browser initialization...");

      this.browser = await puppeteer.launch({
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-third-party-cookies",
        ],
      });

      this.page = await this.browser.newPage();
      this.setupPageErrorHandling();
      console.log("Browser launched successfully");
    } catch (error) {
      console.error("Browser initialization failed:", error);
      await this.safeCloseBrowser();
      throw error;
    }
  }
  async safeCloseBrowser(): Promise<void> {
    try {
      console.log("Starting browser cleanup...");

      // Clean up any active resources
      for (const resource of this.activeResources) {
        console.log(`Cleaning up resource: ${resource}`);
        try {
          await this.page?.evaluate((res) => {
            // Clean up any event listeners or resources
            const element = document.querySelector(res);
            if (element) {
              element.remove();
            }
          }, resource);
        } catch (error) {
          console.error(`Failed to clean resource ${resource}:`, error);
        }
      }
      this.activeResources.clear();

      // Close page
      if (this.page) {
        console.log("Closing page...");
        try {
          await this.page.removeAllListeners();
          await this.page.close();
        } catch (pageError) {
          console.error("Error closing page:", pageError);
        }
        this.page = null;
      }

      // Close browser
      if (this.browser) {
        console.log("Closing browser...");
        try {
          await this.browser.close();
        } catch (browserError) {
          console.error("Error closing browser:", browserError);
        }
        this.browser = null;
      }

      console.log("Cleanup completed successfully");
    } catch (error) {
      console.error("Error during cleanup:", error);
      throw error;
    }
  }

  private async waitAndClick(selector: string) {
    await this.retry(async () => {
      if (!this.page) throw new Error("Browser not initialized");
      await this.page.waitForSelector(selector, { visible: true });
      await this.page.click(selector);
    });
  }
  async goToCalendlyPage(calendlyUrl: string): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");

    try {
      console.log("Navigating to Calendly page...");
      await this.page.goto(calendlyUrl, {
        waitUntil: "networkidle0",
        timeout: 240000, // Increased to 240 seconds
      });

      console.log("Navigation completed");
      await this.page.waitForSelector("#onetrust-accept-btn-handler", {
        timeout: 5000,
      });

      // Click the cookie consent button
      const cookieConsentButton = await this.page.$(
        "#onetrust-accept-btn-handler"
      );
      if (cookieConsentButton) {
        await cookieConsentButton.click();
        console.log("Cookie consent accepted");
        const delay = (ms: number) =>
          new Promise((resolve) => setTimeout(resolve, ms));

        console.log("Waiting for cookie clearance");
        await delay(5000);
      } else {
        console.error("Cookie consent button not found");
      }
    } catch (error) {
      console.error("Error navigating to Calendly page:", error);
      throw error;
    }
  }
  async selectDateAndTime(desiredBookingTime: string): Promise<Date> {
    if (!this.page) throw new Error("Browser not initialized");

    try {
      const utcDate = new Date(desiredBookingTime);
      this.trackResource('[data-container="time-button"]');

      // Create a date object in local timezone for the same calendar date
      const desiredDate = new Date(
        utcDate.getUTCFullYear(),
        utcDate.getUTCMonth(),
        utcDate.getUTCDate(),
        utcDate.getUTCHours(),
        utcDate.getUTCMinutes()
      );

      console.log("Original UTC time:", desiredBookingTime);
      console.log("Local booking time:", desiredDate.toLocaleString());

      // First find and select the date
      const selectedDate = await this.findAndSelectDate(desiredDate);
      if (!selectedDate) {
        throw new Error("Could not find or select the desired date");
      }

      // Then find and select the nearest time slot
      const selectedTime = await this.findAndSelectTime(desiredDate);
      if (!selectedTime) {
        throw new Error("Could not find or select the desired time slot");
      }
      await this.retry(async () => {
        const nextButtonSelector = 'button[role="button"][aria-label^="Next"]';
        await this.page!.waitForSelector(nextButtonSelector);
        await this.page!.click(nextButtonSelector);
      });

      return selectedTime;
    } catch (error) {
      console.error("Error in selecting date and time:", error);
      throw error;
    }
  }

  private async findAndSelectDate(desiredDate: Date): Promise<boolean> {
    // Get desired month and day for comparison
    const desiredMonth = desiredDate.toLocaleString("default", {
      month: "long",
    });
    const desiredDay = desiredDate.getDate();

    let currentMonth = "";
    let monthFound = false;
    let monthNavigationAttempts = 0;
    const maxAttempts = 12;

    while (!monthFound && monthNavigationAttempts < maxAttempts) {
      // First check if we're in the right month by checking any date's aria-label
      const dateButtons = await this.page!.$$(
        'button[type="button"][aria-label*="Times available"]'
      );
      if (dateButtons.length > 0) {
        const ariaLabel = await dateButtons[0].evaluate((el) =>
          el.getAttribute("aria-label")
        );
        if (ariaLabel) {
          const monthMatch = ariaLabel.match(/([A-Za-z]+), ([A-Za-z]+)/);
          if (monthMatch) {
            currentMonth = monthMatch[2];
            if (currentMonth === desiredMonth) {
              monthFound = true;
            }
          }
        }
      }

      // If not in desired month, navigate to next month
      if (!monthFound) {
        const nextMonthButton = await this.page!.$(
          'button[aria-label="Go to next month"]'
        );
        if (!nextMonthButton) {
          throw new Error(`Month ${desiredMonth} not found in calendar`);
        }
        await nextMonthButton.click();
        console.log("Clicked next month button");
        await this.page!.waitForSelector(
          'button[type="button"][aria-label*="Times available"]'
        );
        monthNavigationAttempts++;
        continue;
      }

      // Once in correct month, look for the specific date
      for (const button of dateButtons) {
        const ariaLabel = await button.evaluate((el) =>
          el.getAttribute("aria-label")
        );
        if (!ariaLabel) continue;

        const matches = ariaLabel.match(/([A-Za-z]+), ([A-Za-z]+) (\d+)/);
        if (!matches) continue;

        const dayFromLabel = parseInt(matches[3]);

        if (dayFromLabel === desiredDay) {
          console.log(`Found exact date: ${currentMonth} ${desiredDay}`);

          await this.retry(
            async () => {
              try {
                // Click the date
                await button.click();
                console.log("Clicked date button");

                // Wait for any loading indicators or network activity
                await this.page!.waitForNetworkIdle({ timeout: 5000 }).catch(
                  () => {
                    console.log("Network still active");
                  }
                );

                // Wait and check for time slots
                const timeSlots = await this.page!.evaluate(() => {
                  // Give some time for React/JS to update the DOM
                  return new Promise((resolve) => {
                    let attempts = 0;
                    const checkTimeSlots = () => {
                      const slots = document.querySelectorAll(
                        'button[data-container="time-button"]'
                      );
                      console.log(
                        `Attempt ${attempts + 1}: Found ${
                          slots.length
                        } time slots`
                      );

                      if (slots.length > 0) {
                        resolve(true);
                      } else if (attempts < 2) {
                        // Try for 5 seconds (2 * 500ms)
                        attempts++;
                        setTimeout(checkTimeSlots, 100);
                      } else {
                        resolve(false);
                      }
                    };
                    checkTimeSlots();
                  });
                });

                if (!timeSlots) {
                  console.log("Time slots not found");
                  throw new Error("Time slots not found after waiting");
                }

                console.log("Time slots found successfully");
              } catch (error) {
                console.log("Error during date selection:", error);
                throw error;
              }
            },
            3,
            2000
          ); // 3 retries, 2 second delay

          return true;
        }
      }

      // If we're in the right month but didn't find the date, it means it's not available
      throw new Error(
        `Date ${desiredMonth} ${desiredDay} is not available for booking`
      );
    }

    throw new Error(`Could not find month ${desiredMonth} in calendar`);
  }

  private async findAndSelectTime(desiredDate: Date): Promise<Date> {
    return await this.retry(async () => {
      const timeSlotSelector =
        'button[data-container="time-button"]:not([disabled])';
      await this.page!.waitForSelector(timeSlotSelector);

      const timeSlots = await this.page!.$$(timeSlotSelector);
      console.log(`Found ${timeSlots.length} time slots`);

      // Get local timezone offset in minutes

      // Convert local time to UTC for Calendly
      const targetTime = new Date(desiredDate);
      targetTime.setMinutes(targetTime.getMinutes()); // Convert to UTC

      // Round to nearest 30 minutes
      this.roundTime(targetTime);

      const targetTimeString = targetTime
        .toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
        .slice(0, 5);

      console.log(`Looking for time slot in UTC: ${targetTimeString}`);
      console.log(
        `Original local time requested: ${desiredDate.toLocaleString()}`
      );

      let timeFound = false;
      for (const timeSlot of timeSlots) {
        const startTime = await timeSlot.evaluate((el) =>
          el.getAttribute("data-start-time")
        );
        if (startTime) {
          const timeStr = startTime.replace(/[ap]m$/, "");
          console.log(
            `Comparing - Target UTC: ${targetTimeString}, Available: ${timeStr}`
          );

          if (timeStr === targetTimeString) {
            await timeSlot.click();
            timeFound = true;
            console.log("Found and clicked desired time slot:", startTime);
            break;
          }
        }
      }

      if (!timeFound) {
        throw new Error(
          `Time slot ${targetTimeString} not available for selected date`
        );
      }
      this.roundTime(desiredDate);
      return desiredDate; // Return the local time
    });
  }
  async fillFormAndSubmit(details: FormDetails): Promise<boolean> {
    if (!this.page) throw new Error("Browser not initialized");

    try {
      // Wait for the form to be fully loaded
      console.log("Starting form fill...");
      await this.page.waitForSelector("form");

      // Fill in name
      await this.page.type('input[name="full_name"]', details.name);

      // Fill in email
      await this.page.type('input[name="email"]', details.email);

      console.log("Filled name and email");

      // Handle guest emails if provided
      if (details.guestEmails?.length) {
        console.log("Adding guest emails:", details.guestEmails);
        // Click add guests button
        await this.retry(async () => {
          await this.page!.waitForSelector('button[type="button"] span');
          const buttons = await this.page!.$$('button[type="button"] span');
          let buttonFound = false;

          for (const button of buttons) {
            const text = await button.evaluate((el) => el.textContent?.trim());
            if (text === "Add Guests") {
              await button.click();
              buttonFound = true;
              console.log("Clicked Add Guests button");
              break;
            }
          }

          if (!buttonFound) {
            throw new Error("Add Guests button not found");
          }
        });
        // Add each guest
        for (const guestEmail of details.guestEmails) {
          await this.retry(async () => {
            console.log(`Starting to add guest email: ${guestEmail}`);

            // Using the exact selector for the guest input
            const guestEmailSelector =
              'input[role="combobox"][aria-label="Guest Email(s)"]';
            await this.page!.waitForSelector(guestEmailSelector);

            // Clear any existing value and focus the input
            await this.page!.evaluate((selector) => {
              const input = document.querySelector(
                selector
              ) as HTMLInputElement;
              if (input) {
                input.value = "";
                input.focus();
              }
            }, guestEmailSelector);

            // Type the email
            await this.page!.type(guestEmailSelector, guestEmail);
            console.log(`Typed guest email: ${guestEmail}`);

            // Press Enter
            await this.page!.keyboard.press("Enter");
            console.log(`Pressed Enter for: ${guestEmail}`);

            // Wait for the email to be accepted
            await this.page!.waitForFunction(
              () => {
                const input = document.querySelector(
                  'input[role="combobox"]'
                ) as HTMLInputElement;
                return input && input.value === ""; // Input should be cleared after successful add
              },
              { timeout: 5000 }
            );
            console.log(`Guest email ${guestEmail} was added`);
          });
        }
      }

      // Fill in notes if provided
      // Fill notes if any
      if (details.notes) {
        // Type guard
        const notes: string = details.notes;
        if (notes.trim() !== "") {
          console.log("Adding notes...");
          await this.retry(async () => {
            const notesSelector = 'textarea[name="question_0"]';
            await this.page!.waitForSelector(notesSelector);

            // Validate notes length
            if (notes.length > 10000) {
              throw new Error(
                "Notes exceed maximum length of 10000 characters"
              );
            }

            await this.page!.type(notesSelector, notes);
          });
        }
      }
      await this.retry(async () => {
        const scheduleButtonSelector = 'button[type="submit"]';
        await this.page!.waitForSelector(scheduleButtonSelector);
        console.log("Found Schedule Event button");

        await this.page!.evaluate(() => {
          const button = document.querySelector(
            'button[type="submit"]'
          ) as HTMLButtonElement;
          if (button) button.click();
        });
        console.log("Clicked Schedule Event button");

        // Wait for confirmation
        try {
          await this.page!.waitForNavigation({
            waitUntil: "networkidle0",
            timeout: 10000,
          });
          console.log("Navigation completed after scheduling");
        } catch (error) {
          console.log("No navigation occurred after clicking Schedule Event");
        }
      });

      return true;
    } catch (error) {
      console.error("Error in form filling:", error);
      throw error;
    }
  }

  // Helper method to retry actions in case of failure
  private async retry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retry(fn, retries - 1, delay);
    }
  }
  private async roundTime(targetTime: Date): Promise<void> {
    const minutes = targetTime.getMinutes();
    if (minutes < 15) {
      targetTime.setMinutes(0, 0, 0);
    } else if (minutes < 45) {
      targetTime.setMinutes(30, 0, 0);
    } else {
      targetTime.setMinutes(0, 0, 0);
      targetTime.setHours(targetTime.getHours() + 1);
    }
  }
  // Method to handle page crashes or errors
  private setupPageErrorHandling(): void {
    if (!this.page) return;

    this.page.on("error", async (error) => {
      console.error("Page crashed:", error);
      await this.safeCloseBrowser();
    });

    this.page.on("pageerror", async (error) => {
      console.error("Page error:", error);
      await this.safeCloseBrowser();
    });
  }
  private trackResource(selector: string): void {
    this.activeResources.add(selector);
  }
}
