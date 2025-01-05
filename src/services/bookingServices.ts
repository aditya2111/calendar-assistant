import { BookingModel } from "../models/booking";
import { BookingStatus } from "../types/booking";
import { PuppeteerService } from "./puppeteerService";
import { FormDetails } from "../types/booking";
import { MessageGeneratorService } from "./messageGenerator";
import { EmailService } from "./emailService";

export class BookingService {
  private puppeteerService: PuppeteerService;
  private messageGenerator: MessageGeneratorService;
  private emailService: EmailService;

  constructor() {
    this.puppeteerService = new PuppeteerService();
    this.messageGenerator = new MessageGeneratorService();
    this.emailService = new EmailService();
  }

  async automateBooking(
    bookingId: number,
    calendlyUrl: string,
    details: FormDetails,
    bookingDateTime: string
  ): Promise<void> {
    try {
      // Initialize browser
      await this.puppeteerService.initBrowser();

      console.log("Booking status: Processing");
      await BookingModel.updateStatus(bookingId, BookingStatus.PROCESSING);

      await this.puppeteerService.goToCalendlyPage(calendlyUrl);

      // Single method call for automation
      const bookedDateTime = await this.puppeteerService.selectDateAndTime(
        bookingDateTime
      );

      console.log(`Selected Date and Time: ${bookedDateTime}`);

      console.log("Form Details:", { ...details });

      await this.puppeteerService.fillFormAndSubmit(details);

      await BookingModel.updateBookedFor(bookingId, bookedDateTime);

      console.log("Booking status: Completed");
      await BookingModel.updateStatus(bookingId, BookingStatus.COMPLETED);

      try {
        const messageDetails = {
          name: details.name,
          date: bookedDateTime.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          time: bookedDateTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
          guests: details.guestEmails,
          notes: details.notes,
        };

        const confirmationMessage =
          await this.messageGenerator.generateConfirmationMessage(
            messageDetails
          );
        console.log("Generated confirmation message:", confirmationMessage);

        // Send confirmation email
        await this.emailService.sendEmail({
          to: details.email,
          subject: "Meeting Confirmation",
          text: confirmationMessage,
        });

        // Update to confirmation sent
        await BookingModel.updateStatus(
          bookingId,
          BookingStatus.CONFIRMATION_SENT
        );
      } catch (emailError) {
        // If email fails, booking is still completed but email failed
        console.error("Email sending failed:", emailError);
        // Booking remains in COMPLETED state
      }
    } catch (error) {
      console.error("Booking automation failed:", error);
      await BookingModel.updateStatus(bookingId, BookingStatus.FAILED);
      throw error;
    } finally {
      await this.puppeteerService.closeBrowser();
    }
  }
}
