export interface BookingInput {
  email: string;
  bookingDateTime: string;
  guestEmails?: string[];
  notes?: string;
}
export interface BookingRequest {
  email: string;
  calendlyUrl: string;
  guestEmails?: string[];
  notes?: string;
  bookingDateTime: string; // UTC timestamp
}

export interface Booking {
  id: number;
  uuid: string;
  email: string;
  status: BookingStatus;
  createdat: Date;
  bookedfor: Date | null;
  guestEmails?: string[];
  notes?: string;
}

export enum BookingStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CONFIRMATION_SENT = "CONFIRMATION_SENT",
}
export interface FormDetails {
  name: string;
  email: string;
  guestEmails?: string[];
  notes?: string;
}
