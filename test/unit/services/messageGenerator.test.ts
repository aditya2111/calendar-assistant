// test/unit/services/messageGenerator.test.ts
import { MessageGeneratorService } from "../../../src/services/messageGenerator";

describe("MessageGeneratorService", () => {
  let messageGenerator: MessageGeneratorService;

  jest.setTimeout(30000);

  beforeEach(() => {
    messageGenerator = new MessageGeneratorService();
  });

  it("should generate message for simple meeting", async () => {
    const message = await messageGenerator.generateConfirmationMessage({
      name: "John Doe",
      date: "Monday, January 15, 2024",
      time: "2:30 PM",
    });
    console.log("Simple meeting:\n", message);
    expect(message).toBeTruthy();
  }, 15000);

  it("should generate message with guests", async () => {
    const message = await messageGenerator.generateConfirmationMessage({
      name: "Sarah Smith",
      date: "Tuesday, January 16, 2024",
      time: "3:00 PM",
      guests: ["alice@example.com", "bob@example.com"],
      notes: "Quarterly team review",
    });
    console.log("\nMeeting with guests:\n", message);
    expect(message).toBeTruthy();
  }, 15000);

  it("should generate message with notes", async () => {
    const message = await messageGenerator.generateConfirmationMessage({
      name: "Mike Johnson",
      date: "Wednesday, January 17, 2024",
      time: "10:00 AM",
      notes: "Initial project consultation",
    });
    console.log("\nMeeting with notes:\n", message);
    expect(message).toBeTruthy();
  }, 15000);
});
