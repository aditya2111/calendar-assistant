// src/services/messageGenerator.ts
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

interface MessageDetails {
  name: string;
  date: string;
  time: string;
  guests?: string[];
  notes?: string;
}

export class MessageGeneratorService {
  private model: HuggingFaceInference;
  private promptTemplate: PromptTemplate;

  constructor() {
    this.model = new HuggingFaceInference({
      apiKey: process.env.HUGGINGFACE_API_KEY,
      model: "mistralai/Mixtral-8x7B-Instruct-v0.1", // Changed to recommended model
      temperature: 0.7, // Increased token limit for longer emails
    });

    this.promptTemplate = new PromptTemplate({
      template: `Generate a friendly, professional meeting confirmation email with the following details:
- Name: {name}
- Date: {date}
- Time: {time}
Ensure the message is warm yet professional, avoiding listing guests or excessive details.`,
      inputVariables: ["name", "date", "time"],
    });
  }

  async generateConfirmationMessage(details: MessageDetails): Promise<string> {
    try {
      // Create the chain
      const chain = this.promptTemplate
        .pipe(this.model)
        .pipe(new StringOutputParser());

      // Get the response
      const response = await chain.invoke({
        name: details.name,
        date: details.date,
        time: details.time,
      });

      return response.trim();
    } catch (error) {
      console.error("Error generating message:", error);
      throw new Error("Failed to generate confirmation message");
    }
  }
}
