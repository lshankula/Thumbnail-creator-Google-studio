import { GoogleGenAI, Type } from "@google/genai";
import { ImageSize, VideoFormat } from "../types";

// Helper to get fresh instance with potentially updated key
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const optimizeTitle = async (title: string): Promise<string[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Analyze this YouTube video title: "${title}". Generate 5 shortened, high-CTR (Click Through Rate), punchy alternative titles that would work well on a thumbnail or as a video title.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          titles: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of optimized titles"
          }
        }
      }
    }
  });

  if (response.text) {
    const json = JSON.parse(response.text);
    return json.titles || [];
  }
  return [];
};

export const generateThumbnail = async (
  prompt: string, 
  title: string, 
  size: ImageSize,
  format: VideoFormat,
  headshot?: string, // base64
  referenceImages: string[] = [], // base64s
  logo?: string, // base64
  brandColors?: string
): Promise<string | null> => {
  const ai = getAI();
  const isShorts = format === 'shorts';
  const isFacebook = format === 'facebook';
  
  // Determine aspect ratio
  let aspectRatio = "16:9";
  if (isShorts) aspectRatio = "9:16";
  if (isFacebook) aspectRatio = "1:1";
  
  // Construct the prompt
  let textPrompt = "";
  
  if (isFacebook) {
    textPrompt = `Create a high-quality image for a Facebook post.`;
    if (title) textPrompt += ` The headline or text overlay context is "${title}".`;
    textPrompt += ` \n\nStory/Context: ${prompt}`;
    textPrompt += ` \n\nFormat: Square 1:1. Composition balanced for social feed.`;
    textPrompt += ` \n\nStyle: Natural, authentic, lifestyle photography or clean editorial graphic. Less aggressive than a YouTube thumbnail. Inviting, relatable, and story-driven.`;
  } else {
    textPrompt = `Create a high-quality YouTube ${isShorts ? 'Shorts' : ''} thumbnail.`;
    if (title) textPrompt += ` The video title is "${title}". Include this text or related engaging typography in the thumbnail.`;
    textPrompt += ` \n\nVisual Description: ${prompt}`;
    
    if (isShorts) {
      textPrompt += ` \n\nFormat: Vertical 9:16. Composition must be centered and optimized for mobile full-screen viewing. Keep key visual elements within the safe zone (avoiding top/bottom UI areas). Bold, readable text.`;
    } else {
      textPrompt += ` \n\nFormat: Horizontal 16:9. Cinematic composition, rule of thirds.`;
    }
    textPrompt += ` \n\nStyle: High contrast, vibrant colors, expressive facial expressions (if people are present), clear focal point. Professional YouTuber style.`;
  }

  // Add Brand Colors instructions
  if (brandColors) {
    textPrompt += ` \n\nColor Palette: Use these specific brand colors: ${brandColors}. Ensure they are dominant or used as accents to maintain brand identity.`;
  }

  const parts: any[] = [{ text: textPrompt }];

  // Add Headshot if present
  if (headshot) {
    parts.push({
      inlineData: {
        mimeType: 'image/png', 
        data: headshot
      }
    });
    const subjectTerm = isFacebook ? "image" : "thumbnail";
    parts.push({ text: `Use the person in this image as the main subject in the ${subjectTerm}. Integrate them naturally matching the lighting and style.` });
  }

  // Add Logo if present
  if (logo) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: logo
      }
    });
    parts.push({ text: `Integrate this logo into the image. Place it clearly (e.g. corner or branding area) without obstructing the main subject.` });
  }

  // Add References if present
  referenceImages.forEach((ref, idx) => {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: ref
      }
    });
    parts.push({ text: `Reference style/composition from image #${idx + 1}.` });
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', // Nano Banana Pro for generation
      contents: { parts },
      config: {
        imageConfig: {
          imageSize: size,
          aspectRatio: aspectRatio
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }

  return null;
};

export const editThumbnail = async (
  originalImageBase64: string,
  editInstruction: string
): Promise<string | null> => {
  const ai = getAI();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Flash Image for editing as requested
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: originalImageBase64
            }
          },
          {
            text: `Edit instruction: ${editInstruction}. Maintain the aspect ratio and high quality.`
          }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
  } catch (error) {
    console.error("Image Editing Error:", error);
    throw error;
  }

  return null;
};