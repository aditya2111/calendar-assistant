import { Page } from "puppeteer";
import * as puppeteer from "puppeteer";
import { FormDetails } from "../types/booking";

export class PuppeteerService {
  private page: Page | null = null;
  private browser: puppeteer.Browser | null = null;
  private selectedDate: string | undefined;

  async initBrowser() {
    try {
      console.log("Starting browser initialization...");

      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });

      console.log("Browser launched successfully");
      this.page = await this.browser.newPage();
    } catch (error) {
      console.error("Browser initialization failed:", error);
      console.error("Error details:", error);
      throw error;
    }
  }
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
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
        timeout: 180000, // Increased to 180 seconds
      });
      console.log("Navigation completed");
    } catch (error) {
      console.error("Error navigating to Calendly page:", error);
      throw error;
    }
  }
  async selectDateAndTime(desiredBookingTime: string): Promise<Date> {
    if (!this.page) throw new Error("Browser not initialized");

    try {
      const utcDate = new Date(desiredBookingTime);

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
          await button.click();
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
      const timeSlotSelector = 'button[data-container="time-button"]';
      await this.page!.waitForSelector(timeSlotSelector);

      const timeSlots = await this.page!.$$(timeSlotSelector);
      let timeFound = false;

      const minutes = desiredDate.getMinutes();
      const targetTime = new Date(desiredDate);
      if (minutes < 15) {
        targetTime.setMinutes(0, 0, 0);
      } else if (minutes < 45) {
        targetTime.setMinutes(30, 0, 0);
      } else {
        targetTime.setMinutes(0, 0, 0);
        targetTime.setHours(targetTime.getHours() + 1);
      }

      // Get nearest half hour slot
      const targetTimeString = targetTime
        .toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .toLowerCase();

      console.log(`Looking for nearest available slot to: ${targetTimeString}`);

      for (const timeSlot of timeSlots) {
        const startTime = await timeSlot.evaluate((el) =>
          el.getAttribute("data-start-time")
        );
        if (startTime) {
          // Normalize times for comparison
          const normalizedTargetTime = targetTimeString.replace(/\s/g, "");
          const normalizedStartTime = startTime
            .toLowerCase()
            .replace(/\s/g, "");

          if (normalizedStartTime === normalizedTargetTime) {
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

      return targetTime;
    });
  }
  // Rest of the code for time selection...
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
}
