import { Request, Response } from "express";
import { BookingModel } from "../models/booking";
import { BookingService } from "../services/bookingServices";
import { BookingRequest } from "../types/booking";
import { FormDetails } from "../types/booking";

export class BookingController {
  private bookingService: BookingService;

  constructor() {
    this.bookingService = new BookingService();
  }

  private createFormDetails(
    email: string,
    guestEmails?: string[],
    notes?: string
  ): FormDetails {
    const name = email
      .split("@")[0]
      .split(/[._-]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const details: FormDetails = {
      name,
      email,
    };

    if (guestEmails && guestEmails.length > 0) {
      details.guestEmails = guestEmails;
    }

    if (notes) {
      details.notes = notes;
    }

    return details;
  }

  async createBooking(req: Request, res: Response): Promise<void> {
    try {
      const { email, calendlyUrl, guestEmails, notes, bookingDateTime } =
        req.body as BookingRequest;

      // Validate request
      if (!email || !calendlyUrl || !bookingDateTime) {
        res.status(400).json({
          error:
            "Missing required fields: email, calendlyUrl and bookingDateTime are required",
        });
        return;
      }

      if (this.validateUTCDateTime(bookingDateTime) !== true) {
        res.status(400).json({
          error: "Booking Date and Time is in incorrect format",
        });
        return;
      }

      // Create initial booking
      const booking = await BookingModel.create({
        email,
        bookingDateTime,
        guestEmails,
        notes,
      });
      const details = this.createFormDetails(email, guestEmails, notes);

      try {
        // Wait for automation to complete
        await this.bookingService.automateBooking(
          booking.id,
          calendlyUrl,
          details,
          bookingDateTime
        );

        // Fetch and return the updated booking
        const updatedBooking = await BookingModel.findById(booking.id);
        if (!updatedBooking) {
          throw new Error("Updated booking not found");
        }

        res.status(201).json(updatedBooking);
      } catch (error) {
        // If automation fails, fetch and return the booking with failed status
        const failedBooking = await BookingModel.findById(booking.id);
        res.status(201).json(failedBooking);
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(500).json({
        error: "Failed to create booking",
      });
    }
  }
  private validateUTCDateTime(dateTimeString: string): boolean | string {
    try {
      // Check if the string matches UTC format (YYYY-MM-DDTHH:mm:ssZ)
      const utcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
      if (!utcRegex.test(dateTimeString)) {
        return "Invalid UTC format. Expected format: YYYY-MM-DDTHH:mm:ssZ";
      }

      // Create Date object and validate
      const date = new Date(dateTimeString);

      // Check if it's a valid date
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }

      // Extract components from the string
      const [datePart, timePart] = dateTimeString.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute, secondsZ] = timePart.split(":");
      const seconds = secondsZ.replace("Z", "");

      // Validate ranges
      if (month < 1 || month > 12) return "Month must be between 1 and 12";
      if (day < 1 || day > 31) return "Day must be between 1 and 31";
      if (parseInt(hour) < 0 || parseInt(hour) > 23)
        return "Hour must be between 0 and 23";
      if (parseInt(minute) < 0 || parseInt(minute) > 59)
        return "Minute must be between 0 and 59";
      if (parseInt(seconds) < 0 || parseInt(seconds) > 59)
        return "Seconds must be between 0 and 59";

      // Check for valid day in month (accounting for leap years)
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      if (day > lastDayOfMonth) return `Invalid day for month ${month}`;

      return true;
    } catch (error) {
      return "Invalid date/time format";
    }
  }
}
