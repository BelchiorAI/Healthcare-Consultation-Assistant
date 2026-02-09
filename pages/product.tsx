"use client"

import { useState, FormEvent } from 'react';
import { useAuth } from '@clerk/nextjs';
import DatePicker from 'react-datepicker';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { Protect, PricingTable, UserButton } from '@clerk/nextjs';


function useSpeechRecognition(onResult: (text: string) => void) {
    const [listening, setListening] = useState(false);
  
    const startListening = () => {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
  
      if (!SpeechRecognition) {
        alert("Speech Recognition not supported in this browser");
        return;
      }
  
      const recognition = new SpeechRecognition();
  
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
  
      recognition.onstart = () => {
        setListening(true);
      };
  
      recognition.onend = () => {
        setListening(false);
      };
  
      recognition.onresult = (event: any) => {
        let transcript = "";
  
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
  
        onResult(transcript);
      };
  
      recognition.start();
    };
  
    const stopListening = () => {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
  
      if (!SpeechRecognition) return;
  
      const recognition = new SpeechRecognition();
      recognition.stop();
      setListening(false);
    };
  
    return { startListening, stopListening, listening };
  }
  

function ConsultationForm() {
    const { getToken } = useAuth();

    // Form state
    const [patientName, setPatientName] = useState('');

  
    const [visitDate, setVisitDate] = useState<Date | null>(new Date());
    const [notes, setNotes] = useState('');

    // Streaming state
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);

    // NEW: Text-to-speech state
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [assistantActive, setAssistantActive] = useState(false);
const [assistantReply, setAssistantReply] = useState('');

  
    const { startListening, stopListening, listening } =
    useSpeechRecognition((text) => {
      if (assistantActive) {
        askAssistant(text);
      } else {
        setNotes((prev) => prev + " " + text);
      }
    });
  




    
    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setOutput('');
        setLoading(true);

        const jwt = await getToken();
        if (!jwt) {
            setOutput('Authentication required');
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        let buffer = '';

        await fetchEventSource('/api', {
            signal: controller.signal,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
                patient_name: patientName,
                date_of_visit: visitDate?.toISOString().slice(0, 10),
                notes,
            }),
            onmessage(ev) {
                buffer += ev.data;
                setOutput(buffer);
            },
            onclose() { 
                setLoading(false); 
            },
            onerror(err) {
                console.error('SSE error:', err);
                controller.abort();
                setLoading(false);
            },
        });
    }

    // NEW: Text-to-speech function
   
    
    function speakText(text: string) {
        const utterance = new SpeechSynthesisUtterance(text);
      
        utterance.lang = "en-US";
        utterance.rate = 1;
        utterance.pitch = 1;
      
        speechSynthesis.speak(utterance);
      }


      async function askAssistant(question: string) {
        const jwt = await getToken();
        if (!jwt) return;
      
        try {
          const res = await fetch('/api/assistant', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ message: question }),
          });
      
          const data = await res.json();
      
          setAssistantReply(data.reply);
      
          // Speak reply
          speakText(data.reply);
      
        } catch (err) {
          console.error("Assistant error:", err);
        }
      }
      
      
    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8">
                Consultation Notes
            </h1>

{/* AI Voice Assistant */}
<div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900 rounded-xl shadow">

  <div className="flex items-center justify-between">

    <div>
      <h2 className="font-semibold text-indigo-700 dark:text-indigo-200">
        🤖 AI Voice Assistant
      </h2>

      <p className="text-sm text-indigo-600 dark:text-indigo-300">
        Ask medical questions by voice
      </p>
    </div>

    <button
      type="button"
      onClick={() => setAssistantActive(!assistantActive)}
      className={`px-4 py-2 rounded-lg text-white ${
        assistantActive
          ? 'bg-red-600 hover:bg-red-700'
          : 'bg-indigo-600 hover:bg-indigo-700'
      }`}
    >
      {assistantActive ? 'Disable' : 'Enable'}
    </button>

  </div>

  {assistantReply && (
    <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg text-sm">
      <strong>Assistant:</strong> {assistantReply}
    </div>
  )}

</div>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                <div className="space-y-2">
                    <label htmlFor="patient" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Patient Name
                    </label>
                    <input
                        id="patient"
                        type="text"
                        required
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Enter patient's full name"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Date of Visit
                    </label>
                    <DatePicker
                        id="date"
                        selected={visitDate}
                        onChange={(d: Date | null) => setVisitDate(d)}
                        dateFormat="yyyy-MM-dd"
                        placeholderText="Select date"
                        required
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Consultation Notes
                    </label>
                    <div className="space-y-2">
 

  {/* Voice Controls */}
  <div className="flex gap-3 mb-2">
    {!listening ? (
      <button
        type="button"
        onClick={startListening}
        className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded-lg text-sm"
      >
        🎤 Start Dictation
      </button>
    ) : (
      <button
        type="button"
        onClick={stopListening}
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded-lg text-sm"
      >
        ⏹ Stop
      </button>
    )}

    {listening && (
      <span className="text-sm text-green-600 font-medium">
        Listening...
      </span>
    )}
  </div>

  <textarea
    id="notes"
    required
    rows={8}
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
    placeholder="Speak or type consultation notes..."
  />
</div>

                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                >
                    {loading ? 'Generating Summary...' : 'Generate Summary'}
                </button>
            </form>

            {output && (
                <section className="mt-8 bg-gray-50 dark:bg-gray-800 rounded-xl shadow-lg p-8">
                    {/* NEW: Read Aloud Button */}
                    <div className="mb-4 flex gap-2">
                        <button
                            onClick={() => speakText(output)}
                            disabled={isSpeaking}
                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200 flex items-center gap-2"
                        >
                            {isSpeaking ? (
                                <>
                                    <span className="animate-pulse">🔊</span>
                                    Speaking...
                                </>
                            ) : (
                                <>
                                    🔊 Read Aloud
                                </>
                            )}
                        </button>
                    </div>
                    
                    <div className="markdown-content prose prose-blue dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                            {output}
                        </ReactMarkdown>
                    </div>
                </section>
            )}
        </div>
    );



    
      

}

export default function Product() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            {/* User Menu in Top Right */}
            <div className="absolute top-4 right-4">
                <UserButton showName={true} />
            </div>

            {/* Subscription Protection */}
            <Protect
                plan="premium_subscription"
                fallback={
                    <div className="container mx-auto px-4 py-12">
                        <header className="text-center mb-12">
                            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                                Healthcare Professional Plan
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
                                Streamline your patient consultations with AI-powered summaries
                            </p>
                        </header>
                        <div className="max-w-4xl mx-auto">
                            <PricingTable />
                        </div>
                    </div>
                }
            >
                <ConsultationForm />
            </Protect>
        </main>
    );
}