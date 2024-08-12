import { Anthropic } from "@anthropic-ai/sdk";
import * as vscode from "vscode";

import { ClaudeMessage, ClaudeConversation } from "../types";

export async function streamClaude(
  claudeConversation: ClaudeConversation,
  processPartial: (text: string) => void
): Promise<string> {
  const config = vscode.workspace.getConfiguration("spectacle");
  const apiKey = config.get<string>("anthropicApiKey");

  if (!apiKey) {
    throw new Error(
      "Anthropic API key is not set. Please configure it in settings."
    );
  }

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  try {
    console.log("waiting for claude...");
    const stream = await anthropic.messages
      .stream(
        {
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 4096,
          messages: claudeConversation.messages as any,
          system: claudeConversation.system,
          stream: true,
        },
        {
          headers: {
            "anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15",
          },
        }
      )
      .on("text", processPartial);

    const final = await stream.finalMessage();
    const textContent = final.content.find((block) => "text" in block);
    if (textContent && "text" in textContent) {
      return textContent.text.trim();
    } else {
      throw new Error("No text content found in the response");
    }
  } catch (error) {
    console.log("Error communicating with Claude: ", error);
    console.log("Messages was: ", claudeConversation.messages);
    console.log("System was: ", claudeConversation.system);
    throw error;
  }
}

// // example
// const stream = streamClaude(messages, system
//   (partialText) => { partialText + "hi!" },
// )
//   .on('text', (text) => {
//     console.log(text);
//   });

// const message = await stream.finalMessage();
// console.log(message);
