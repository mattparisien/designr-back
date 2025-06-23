// config/settings.js
import dotenv from 'dotenv';
import { OpenAI } from '@langchain/openai';

dotenv.config();

export const model = new OpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    modelName: 'gpt-4'
});