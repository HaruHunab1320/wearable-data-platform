import axios from "axios";
import openai from "openai";
import { imageToBase64 } from "../utils/imageToBase64";
export async function transcribeAudio(audioData: Blob) {
  const formData = new FormData();
  formData.append("file", audioData, "audio.wav");
  formData.append("model", "whisper-1");

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
  }
  return audioContext;
}

let audioStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
const audioChunks: Blob[] = [];

export async function startAudio(onChunkRecorded: (chunk: Blob) => void) {
  try {
    audioContext = new AudioContext();
    console.log("Audio context initialized successfully");

    // Request microphone access
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("Microphone access granted");

    // Create a MediaRecorder instance with WebM/Opus encoding
    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: "audio/webm;codecs=pcm",
    });
    console.log("MediaRecorder created");

    // Set up event listeners
    mediaRecorder.ondataavailable = (event) => {
      const chunk = event.data;
      audioChunks.push(chunk);
      console.log(
        `Audio chunk received: ${chunk.size} bytes, type: ${chunk.type} with data`
      );
      onChunkRecorded(chunk); // Emit the chunk
    };

    mediaRecorder.onstart = () => {
      console.log("MediaRecorder started");
    };

    mediaRecorder.onstop = () => {
      console.log("MediaRecorder stopped");
      const audioBlob = new Blob(audioChunks, {
        type: "audio/webm;codecs=opus",
      });
      console.log(`Total audio size: ${audioBlob.size} bytes`);
    };

    // Start recording and emit chunks every 1 second
    mediaRecorder.start(1000);
    console.log("Audio recording started");
  } catch (error) {
    console.error("Error initializing audio:", error);
    throw error;
  }
}

export function stopAudio() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    console.log("Audio recording stopped");
  }
  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop());
    console.log("Audio stream tracks stopped");
  }
  audioChunks.length = 0; // Clear the audio chunks
  console.log("Audio chunks cleared");
}

export async function textToSpeech(text: string) {
  try {
    console.log(`Sending text to speech: "${text}"`);
    const response = await axios.post(
      "https://api.openai.com/v1/audio/speech",
      {
        input: text, // Use 'input' instead of 'text'
        voice: "nova",
        model: "tts-1",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer", // This will handle the binary data correctly
      }
    );
    console.log("Received audio response from OpenAI");

    const context = getAudioContext();

    // Decode the audio data asynchronously
    const audioBuffer = await context.decodeAudioData(response.data);
    console.log(
      `Decoded audio buffer: duration ${audioBuffer.duration} seconds`
    );

    // Create an audio source
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.start(); // Play the audio immediately
    console.log("Started playing audio");

    return response.data;
  } catch (error) {
    console.error("Error in textToSpeech:", error);
    return null; // or handle error differently
  }
}

export async function describeImage(imagePath: string) {
  const imageBase64 = imageToBase64(imagePath);
  try {
    const client = new openai({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a highly intelligent and detailed visual analyst AI specializing in generating accurate, comprehensive, and context-aware descriptions of images. Your role is to analyze the content of any image deeply and describe it in clear, vivid, and precise language.

Follow these guidelines when describing images:

Objects & Entities: List and describe all recognizable objects, people, animals, and notable entities within the image. Specify their positions relative to one another, along with their colors, textures, and shapes.
Actions & Interactions: Clearly describe any actions occurring in the image, including interactions between objects, people, or the environment.
Setting & Environment: Provide context for where the image is set. Include details like whether it’s indoor or outdoor, natural or artificial lighting, time of day (if visible), and any weather conditions or other environmental elements.
Contextual Information: Infer the possible mood, purpose, or background story of the image, but only when the visual information clearly supports this. Stay as close as possible to the factual details present in the image.
Fine Details: Capture even minor details such as textures, patterns, reflections, shadows, and light sources. Focus on subtleties that might be overlooked but contribute to the overall understanding of the image.
Avoid Assumptions: If a detail is unclear or ambiguous, describe it as such without making unwarranted assumptions.
Your descriptions should be vivid and provide the level of detail necessary for someone who cannot see the image to fully grasp its contents.`,
        },
        { role: "user", content: imageBase64 },
      ],
    });
    console.log("RESZ", response);
    if (response.choices[0].message.content) {
      return response.choices[0].message.content;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error in describeImage:", error);
    return null; // or handle error differently
  }
}

export async function gptRequest(systemPrompt: string, userPrompt: string) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error in gptRequest:", error);
    return null; // or handle error differently
  }
}

// textToSpeech("Hello I am an agent");
console.info(
  gptRequest(
    `
                You are a smart AI that need to read through description of a images and answer user's questions.

                This are the provided images:
                The image features a woman standing in an open space with a metal roof, possibly at a train station or another large building.
                She is wearing a hat and appears to be looking up towards the sky.
                The scene captures her attention as she gazes upwards, perhaps admiring something above her or simply enjoying the view from this elevated position.

                DO NOT mention the images, scenes or descriptions in your answer, just answer the question.
                DO NOT try to generalize or provide possible scenarios.
                ONLY use the information in the description of the images to answer the question.
                BE concise and specific.
            `,
    "where is the person?"
  )
);
