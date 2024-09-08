import { Anthropic } from "@anthropic-ai/sdk";
import * as vscode from "vscode";
import { CancellationToken } from "vscode";
import * as utils from "util/utils";

import { ClaudeConversation } from "../types";
import { ErrorOperationCancelled } from 'util/utils';

export enum Models {
	Claude35Sonnet = "claude-3-5-sonnet-20240620",
	Claude3Haiku = "claude-3-haiku-20240307",
}

export async function streamClaude(
	claudeConversation: ClaudeConversation,
	opts: {
		model?: Models,
		cancellationToken?: CancellationToken,
		processPartial?: (text: string) => void,
	} = {}): Promise<string> {
	const { model = Models.Claude35Sonnet, cancellationToken, processPartial } = opts;

	if (claudeConversation.messages.length === 0) {
		throw new Error("No messages in prompt");
	}

	const config = vscode.workspace.getConfiguration("melty");
	let apiKey = config.get<string>("anthropicApiKey");
	let baseURL = "https://melty-api.fly.dev/anthropic"

	// If the user provides an API key, go direct to Claude, otherwise proxy to Melty
	if (apiKey) {
		console.log("API KEY SET — DIRECT TO ANTHROPIC")
		baseURL = "https://api.anthropic.com"
	} else {
		console.log("NO API KEY — PROXYING")
		apiKey = "dummyToken"
	}

	const anthropic = new Anthropic({
		apiKey: apiKey,
		baseURL: baseURL
	});

	try {
		console.log("waiting for claude...");
		const stream = anthropic.messages
			.stream(
				{
					model: model,
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
			.on("text", (textDelta: string, _textSnapshot: string) => {
				if (cancellationToken?.isCancellationRequested) {
					stream.controller.abort();
					return;
				}
				if (processPartial) {
					processPartial(textDelta);
				}
			})
			.on('error', (error) => {
				utils.logErrorVerbose("Claude error (streaming)", error);
			});

		if (cancellationToken?.isCancellationRequested) {
			throw new ErrorOperationCancelled();
		}
		const final = await stream.finalMessage();
		const textContent = final.content.find((block) => "text" in block);
		if (textContent && "text" in textContent) {
			return textContent.text.trim();
		} else {
			throw new Error("No text content found in the response");
		}
	} catch (error) {
		utils.logErrorVerbose("Claude error (final)", error);
		throw error;
	}
}
