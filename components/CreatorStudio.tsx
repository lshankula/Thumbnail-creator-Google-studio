import React, { useState, useRef } from 'react';
import { optimizeTitle, generateThumbnail, editThumbnail } from '../services/geminiService';
import { ImageSize, GeneratedImage, LoadingState, VideoFormat } from '../types';
import { SparklesIcon, PhotoIcon, EditIcon, UploadIcon, XMarkIcon, WandIcon } from './Icons';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        let encoded = reader.result as string;
        // Remove data URL prefix to get pure base64 if needed, 
        // but Gemini supports data URIs or base64. 
        // The service layer expects just base64 data for `inlineData`.
        const base64Content = encoded.split(',')[1];
        resolve(base64Content);
    };
    reader.onerror = error => reject(error);
  });
};

const CreatorStudio: React.FC = () => {
  // State
  const [title, setTitle] = useState('');
  const [optimizedTitles, setOptimizedTitles] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.Size1K);
  const [videoFormat, setVideoFormat] = useState<VideoFormat>('long-form');
  
  const [headshot, setHeadshot] = useState<{ name: string, data: string } | null>(null);
  const [logo, setLogo] = useState<{ name: string, data: string } | null>(null);
  const [referenceImages, setReferenceImages] = useState<{ name: string, data: string }[]>([]);
  const [brandColors, setBrandColors] = useState('');
  
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Refs for file inputs
  const headshotInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleTitleOptimize = async () => {
    if (!title.trim()) return;
    setLoadingState('optimizing_title');
    setError(null);
    try {
      const suggestions = await optimizeTitle(title);
      setOptimizedTitles(suggestions);
    } catch (e: any) {
        console.error(e);
      setError("Failed to optimize title. Please try again.");
    } finally {
      setLoadingState('idle');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'headshot' | 'reference' | 'logo') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const base64 = await fileToBase64(file);
        if (type === 'headshot') {
          setHeadshot({ name: file.name, data: base64 });
        } else if (type === 'logo') {
          setLogo({ name: file.name, data: base64 });
        } else {
          setReferenceImages(prev => [...prev, { name: file.name, data: base64 }]);
        }
      } catch (err) {
        setError("Failed to process image.");
      }
    }
    // Reset value to allow re-uploading same file
    if (e.target) e.target.value = '';
  };

  const removeReference = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
        setError("Please enter a description or story for the image.");
        return;
    }
    setLoadingState('generating_image');
    setError(null);
    
    try {
      const refData = referenceImages.map(r => r.data);
      const resultBase64 = await generateThumbnail(
        prompt, 
        title, 
        imageSize,
        videoFormat,
        headshot?.data, 
        refData,
        logo?.data,
        brandColors
      );
      
      if (resultBase64) {
        setGeneratedImage({
          id: Date.now().toString(),
          data: resultBase64,
          mimeType: 'image/png',
          prompt: prompt,
          timestamp: Date.now(),
          format: videoFormat
        });
      } else {
        setError("No image generated.");
      }
    } catch (e: any) {
        console.error(e);
      setError("Generation failed. Try a simpler prompt or fewer references.");
    } finally {
      setLoadingState('idle');
    }
  };

  const handleEdit = async () => {
    if (!generatedImage || !editPrompt.trim()) return;
    setLoadingState('editing_image');
    setError(null);

    try {
      const resultBase64 = await editThumbnail(generatedImage.data, editPrompt);
      if (resultBase64) {
        setGeneratedImage(prev => prev ? ({
          ...prev,
          data: resultBase64,
          id: Date.now().toString(),
        }) : null);
        setEditPrompt('');
      }
    } catch (e: any) {
        console.error(e);
      setError("Editing failed.");
    } finally {
      setLoadingState('idle');
    }
  };

  const isFacebook = videoFormat === 'facebook';

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-black text-white overflow-hidden">
      
      {/* Left Sidebar - Controls */}
      <div className="w-full lg:w-[450px] flex flex-col border-r border-zinc-800 bg-zinc-950 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
            </div>
            <h1 className="font-bold text-xl tracking-tight">TubeThumb AI</h1>
          </div>

          {/* Section 1: Title/Headline */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              {isFacebook ? 'Headline / Text (Optional)' : 'Video Title'}
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isFacebook ? "e.g. Exciting News!" : "e.g. My Trip to Japan"}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
              />
              {!isFacebook && (
                <button 
                  onClick={handleTitleOptimize}
                  disabled={loadingState !== 'idle' || !title}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-lg disabled:opacity-50 transition-colors"
                  title="Optimize Title"
                >
                  {loadingState === 'optimizing_title' ? <div className="w-5 h-5 border-2 border-zinc-400 border-t-white rounded-full animate-spin"></div> : <SparklesIcon className="w-5 h-5" />}
                </button>
              )}
            </div>
            {!isFacebook && optimizedTitles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {optimizedTitles.map((t, i) => (
                  <button 
                    key={i} 
                    onClick={() => setTitle(t)}
                    className="text-xs bg-zinc-900 border border-zinc-800 hover:border-red-900 hover:text-red-100 text-zinc-300 px-3 py-1.5 rounded-full transition-colors text-left"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <hr className="border-zinc-800 mb-8" />

          {/* Section 2: Generation Config */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                {isFacebook ? 'Story / Context' : 'Visual Description'}
              </label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={isFacebook ? "Tell the story behind this post to generate a relevant image..." : "Describe what you want in the thumbnail..."}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm min-h-[100px] focus:outline-none focus:border-zinc-600 resize-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Format</label>
                <div className="flex p-1 bg-zinc-900 rounded-lg border border-zinc-800">
                  <button 
                    onClick={() => setVideoFormat('long-form')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${videoFormat === 'long-form' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title="Horizontal 16:9"
                  >
                    16:9
                  </button>
                  <button 
                    onClick={() => setVideoFormat('shorts')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${videoFormat === 'shorts' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title="Vertical 9:16"
                  >
                    9:16
                  </button>
                  <button 
                    onClick={() => setVideoFormat('facebook')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${videoFormat === 'facebook' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title="Facebook Square 1:1"
                  >
                    Post
                  </button>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Quality</label>
                <div className="flex p-1 bg-zinc-900 rounded-lg border border-zinc-800">
                   <select 
                     value={imageSize}
                     onChange={(e) => setImageSize(e.target.value as ImageSize)}
                     className="w-full bg-transparent text-xs font-medium text-zinc-300 focus:outline-none cursor-pointer py-1.5 px-2"
                   >
                     {Object.values(ImageSize).map((size) => (
                       <option key={size} value={size}>{size}</option>
                     ))}
                   </select>
                </div>
              </div>
            </div>

            {/* Brand Kit Section */}
            <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Brand Kit (Optional)</label>
                <div className="space-y-4">
                    <input 
                        type="text" 
                        value={brandColors}
                        onChange={(e) => setBrandColors(e.target.value)}
                        placeholder="Brand colors e.g. Neon Green, #00FF00"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-zinc-600"
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div 
                            onClick={() => logoInputRef.current?.click()}
                            className="cursor-pointer h-16 border border-dashed border-zinc-700 rounded-lg flex items-center justify-center hover:bg-zinc-900 hover:border-zinc-500 transition-colors group relative overflow-hidden"
                        >
                            {logo ? (
                                <>
                                    <img src={`data:image/png;base64,${logo.data}`} className="h-full p-2 object-contain opacity-80 group-hover:opacity-50 transition-opacity" alt="logo" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                         <span className="text-xs text-white font-bold drop-shadow-md">Change</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); setLogo(null); }} className="absolute top-1 right-1 p-0.5 bg-black/50 rounded-full hover:bg-red-500/80 transition-colors">
                                        <XMarkIcon className="w-3 h-3 text-white" />
                                    </button>
                                </>
                            ) : (
                                <div className="flex items-center gap-2 text-zinc-500 group-hover:text-zinc-400">
                                    <UploadIcon className="w-4 h-4" />
                                    <span className="text-xs">Upload Logo</span>
                                </div>
                            )}
                            <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Assets */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Your Headshot</label>
                <div 
                  onClick={() => headshotInputRef.current?.click()}
                  className="cursor-pointer h-24 border border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center hover:bg-zinc-900 hover:border-zinc-500 transition-colors group relative overflow-hidden"
                >
                  {headshot ? (
                    <>
                        <img src={`data:image/png;base64,${headshot.data}`} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" alt="headshot" />
                        <div className="relative z-10 flex flex-col items-center">
                            <span className="text-xs text-white font-medium truncate max-w-[80px]">{headshot.name}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setHeadshot(null); }} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full hover:bg-red-500/80 transition-colors">
                            <XMarkIcon className="w-3 h-3 text-white" />
                        </button>
                    </>
                  ) : (
                    <>
                        <UploadIcon className="w-6 h-6 text-zinc-600 group-hover:text-zinc-400 mb-1" />
                        <span className="text-xs text-zinc-600 group-hover:text-zinc-400">Upload</span>
                    </>
                  )}
                  <input ref={headshotInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'headshot')} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">References</label>
                <div 
                  onClick={() => refInputRef.current?.click()}
                  className="cursor-pointer h-24 border border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center hover:bg-zinc-900 hover:border-zinc-500 transition-colors group"
                >
                   <UploadIcon className="w-6 h-6 text-zinc-600 group-hover:text-zinc-400 mb-1" />
                   <span className="text-xs text-zinc-600 group-hover:text-zinc-400">Add Ref</span>
                   <input ref={refInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'reference')} />
                </div>
              </div>
            </div>

            {/* Reference List */}
            {referenceImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {referenceImages.map((ref, idx) => (
                        <div key={idx} className="relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border border-zinc-800">
                             <img src={`data:image/png;base64,${ref.data}`} className="w-full h-full object-cover" alt="ref" />
                             <button onClick={() => removeReference(idx)} className="absolute top-0 right-0 bg-black/70 p-0.5 hover:bg-red-600">
                                 <XMarkIcon className="w-3 h-3 text-white" />
                             </button>
                        </div>
                    ))}
                </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loadingState !== 'idle' || !prompt}
              className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {loadingState === 'generating_image' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                <>
                  <WandIcon className="w-5 h-5" />
                  Generate {videoFormat === 'shorts' ? 'Shorts' : videoFormat === 'facebook' ? 'Post' : 'Thumbnail'}
                </>
              )}
            </button>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-xs">
                    {error}
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Area - Canvas / Preview */}
      <div className="flex-1 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black flex flex-col relative">
        
        {/* Toolbar */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
            {generatedImage && (
                <a 
                    href={`data:${generatedImage.mimeType};base64,${generatedImage.data}`} 
                    download={`thumbnail-${generatedImage.id}.png`}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg border border-zinc-700"
                >
                    Download
                </a>
            )}
        </div>

        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          {generatedImage ? (
            <div 
              className={`relative shadow-2xl rounded-xl overflow-hidden border border-zinc-800 group transition-all duration-300 
                ${generatedImage.format === 'shorts' ? 'h-full max-h-[85vh] aspect-[9/16]' : 
                  generatedImage.format === 'facebook' ? 'h-full max-h-[85vh] aspect-square' : 
                  'w-full max-w-5xl aspect-video'}`}
            >
                {/* Image Container */}
                <div className="w-full h-full bg-zinc-900 relative">
                    <img 
                        src={`data:${generatedImage.mimeType};base64,${generatedImage.data}`} 
                        alt="Generated Output" 
                        className="w-full h-full object-contain"
                    />
                    
                    {loadingState === 'editing_image' && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                             <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                             <p className="font-medium animate-pulse">Applying edits with Gemini 2.5 Flash...</p>
                        </div>
                    )}
                </div>
            </div>
          ) : (
            <div className="text-center text-zinc-600 max-w-md">
                <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-800">
                    <PhotoIcon className="w-10 h-10 opacity-50" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-300 mb-2">Ready to Create</h3>
                <p className="text-sm">Enter a title and description, upload your headshot, and let AI build your next viral {videoFormat === 'shorts' ? 'Short' : videoFormat === 'facebook' ? 'Post' : 'thumbnail'}.</p>
            </div>
          )}
        </div>

        {/* Bottom Edit Bar */}
        {generatedImage && (
            <div className="border-t border-zinc-800 bg-zinc-950 p-6">
                <div className="max-w-3xl mx-auto">
                    <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                        <EditIcon className="w-4 h-4" />
                        AI Magic Edit
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                            placeholder='e.g. "Add a retro filter", "Make the text brighter", "Remove background objects"'
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-900/50 transition-colors"
                        />
                        <button 
                            onClick={handleEdit}
                            disabled={loadingState !== 'idle' || !editPrompt}
                            className="bg-white text-black font-medium px-6 py-2 rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default CreatorStudio;