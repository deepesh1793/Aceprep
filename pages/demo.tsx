import { AnimatePresence, motion } from "framer-motion";
import { RadioGroup } from "@headlessui/react";
import { v4 as uuid } from "uuid";
import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useRouter } from "next/router";



const questions = [
  {
    id: 1,
    name: "Behavioral",
    description: "From LinkedIn, Amazon, Adobe",
    difficulty: "Easy",
    prompts: [
      // "Walk me through your resume and introduce yourself.",
      // "Tell me your strengths.",
    ],
    topics: [
      { id: 1, name: "Resume Walkthrough" },
      { id: 2, name: "Strengths and Weaknesses" },
    ],
  },
  {
    id: 2,
    name: "Technical",
    description: "From Google, Meta, and Apple",
    difficulty: "Medium",
    prompts: [
      // "What is a Hash Table and its time complexities?",
      // "Explain the difference between a stack and a queue.",
    ],
    topics: [
      { id: 1, name: "DSA" },
      { id: 2, name: "OS" },
      { id: 3, name: "OOPS" },
      { id: 4, name: "DBMS" },
    ],
  },
];

const videoSources1 = [
  "/videos/aiagent1.mp4",
  "/videos/aiagent4.mp4",
];
const videoSources2 = [
  "/videos/aiagent3.mp4",
  "/videos/aiagent2.mp4",
];

const ffmpeg = createFFmpeg({
  corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
  log: true,
});

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function DemoPage() {
  const [allQuestions, setAllQuestions] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("Tell me about yourself. Why don’t you walk me through your resume?");
  const [selected, setSelected] = useState(questions[0]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const webcamRef = useRef<Webcam | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [seconds, setSeconds] = useState(150);
  const [videoEnded, setVideoEnded] = useState(false);
  const [recordingPermission, setRecordingPermission] = useState(true);
  const [cameraLoaded, setCameraLoaded] = useState(false);
  const vidRef = useRef<HTMLVideoElement>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("Processing");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [overallFeedback, setOverallFeedback] = useState<string>("");
  const [overallScore, setOverallScore] = useState<number>(0);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const router = useRouter();
  const [isLoadingResumeQuestions, setIsLoadingResumeQuestions] = useState(false);

  // Initialize Gemini API
  const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

  // Function to generate questions using Gemini API
  const generateQuestionsWithGemini = async (topic: string) => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Generate 5 short and concise random interview questions related to the topic: ${topic}. Ensure they are easy to medium difficulty and relevant for job interviews.`;
      const response = await model.generateContent(prompt);
      const result = await response.response;
      const generatedQuestions = result.text().trim().split("\n"); // Split questions by newline
      return generatedQuestions;
    } catch (error) {
      console.error("Error generating questions:", error);
      return []; // Fallback to an empty array if the API fails
    }
  };

  useEffect(() => {
    if (selectedTopic && !isLoadingResumeQuestions) {
      // If we already have questions (from resume upload), don't regenerate
      if (selectedTopic.name === "Resume Walkthrough" && allQuestions.length > 0) {
        setStep(3);
        return;
      }

      if (selectedTopic.name === "Resume Walkthrough") {
        router.push("/resume-upload");
        return;
      }

      const fetchAllQuestions = async () => {
        const questions = await generateQuestionsWithGemini(selectedTopic.name);
        setAllQuestions(questions);
        setSelected(prev => ({ ...prev, prompts: questions }));
      };

      fetchAllQuestions();
    }
  }, [selectedTopic, router, isLoadingResumeQuestions]);

  useEffect(() => {
    const resumeQuestions = sessionStorage.getItem('resumeQuestions');
    if (resumeQuestions) {
      setIsLoadingResumeQuestions(true);
      try {
        const questions = JSON.parse(resumeQuestions);
        console.log("Resume questions:", questions);

        // Update all questions state
        setAllQuestions(questions);

        // Update the selected question set with the resume questions
        setSelected(prev => ({
          ...prev,
          prompts: questions,
          name: "Resume Walkthrough",  // Ensure proper type
          description: "Generated from your resume"
        }));

        setSelectedTopic({ id: 1, name: "Resume Walkthrough" });
        setStep(3); // Force step to 3

        // Clear any existing responses/feedback
        setResponses([]);
        setFeedbacks([]);
        setCurrentQuestionIndex(0);

      } catch (error) {
        console.error("Error parsing resume questions:", error);
      } finally {
        setIsLoadingResumeQuestions(false);
        sessionStorage.removeItem('resumeQuestions');
      }
    }
  }, []);

  // During the interview, use the pre-generated questions
  const handleNextQuestion = () => {
    if (currentQuestionIndex < allQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1); // Move to the next question
    } else {
      setCompleted(true); // Mark the interview as completed
    }
  };

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const handleVideoEnd = () => {
    setVideoEnded(true);
    const activeVideoSources = selected === questions[0] ? videoSources1 : videoSources2;
    const nextIndex = (currentVideoIndex + 1) % activeVideoSources.length;
    setCurrentVideoIndex(nextIndex);
  };

  useEffect(() => {
    setIsDesktop(window.innerWidth >= 768);
  }, []);

  useEffect(() => {
    if (videoEnded) {
      const element = document.getElementById("startTimer");
      if (element) {
        element.style.display = "flex";
      }
      setCapturing(true);
      setIsVisible(false);
      mediaRecorderRef.current = new MediaRecorder(
        webcamRef?.current?.stream as MediaStream
      );
      mediaRecorderRef.current.addEventListener(
        "dataavailable",
        handleDataAvailable
      );
      mediaRecorderRef.current.start();
    }
  }, [videoEnded, webcamRef, setCapturing, mediaRecorderRef]);

  const handleStartCaptureClick = useCallback(() => {
    const startTimer = document.getElementById("startTimer");
    if (startTimer) {
      startTimer.style.display = "none";
    }
    if (vidRef.current) {
      vidRef.current.play();
    }
  }, [webcamRef, setCapturing, mediaRecorderRef]);

  const handleDataAvailable = useCallback(
    ({ data }: BlobEvent) => {
      if (data.size > 0) {
        setRecordedChunks((prev) => prev.concat(data));
      }
    },
    [setRecordedChunks]
  );

  const handleStopCaptureClick = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setCapturing(false);
  }, [mediaRecorderRef, webcamRef, setCapturing]);

  useEffect(() => {
    let timer: any = null;
    if (capturing) {
      timer = setInterval(() => {
        setSeconds((seconds) => seconds - 1);
      }, 1000);
      if (seconds === 0) {
        handleStopCaptureClick();
        setCapturing(false);
        setSeconds(0);
      }
    }
    return () => {
      clearInterval(timer);
    };
  });

  const handleDownload = async () => {
    if (recordedChunks.length) {
      setSubmitting(true);
      setStatus("Processing");

      try {
        // Convert recorded chunks to a video file
        const file = new Blob(recordedChunks, {
          type: `video/webm`,
        });

        const unique_id = uuid();

        // Load FFmpeg if not already loaded
        if (!ffmpeg.isLoaded()) {
          await ffmpeg.load();
        }

        // Write the video file to FFmpeg's file system
        ffmpeg.FS("writeFile", `${unique_id}.webm`, await fetchFile(file));

        // Convert video to audio (MP3)
        await ffmpeg.run(
          "-i",
          `${unique_id}.webm`,
          "-vn",
          "-acodec",
          "libmp3lame",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-f",
          "mp3",
          `${unique_id}.mp3`
        );

        // Read the converted audio file
        const fileData = ffmpeg.FS("readFile", `${unique_id}.mp3`);
        const output = new File([fileData.buffer], `${unique_id}.mp3`, {
          type: "audio/mp3",
        });

        // Prepare form data for transcription API
        const formData = new FormData();
        formData.append("file", output, `${unique_id}.mp3`);
        formData.append("model", "whisper-1");

        const question = allQuestions[currentQuestionIndex]; // Use pre-generated questions

        setStatus("Transcribing");

        // Send the audio file to the transcription API
        const upload = await fetch(
          `/api/transcribe?question=${encodeURIComponent(question)}`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!upload.ok) {
          throw new Error("Transcription failed");
        }

        const results = await upload.json();
        const transcriptText = results.error ? results.error : results.transcript;

        // Generate feedback using the transcript
        const prompt = `Please give feedback on the following interview question: ${question} given the following transcript: ${transcriptText}. ${selected.name === "Behavioral"
          ? "Please also give feedback on the candidate's communication skills. Make sure their response is structured (perhaps using the STAR or PAR frameworks). Be critical with your feedback and provide actionable advice.If no transcript is recieved or it is irrelevent, make sure to mention that in the feedback. Be strict with your feedback."
          : "Please also give feedback on the candidate's communication skills. Make sure they accurately explain their thoughts in a coherent way. Make sure they stay on topic and relevant to the question. Be critical with your feedback and provide actionable advice. If no transcript is recieved or it is irrelevent, make sure to mention that in the feedback. Be strict with your feedback."
          } \n\n\ Feedback on the candidate's response:`;

        const feedbackResponse = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
          }),
        });

        if (!feedbackResponse.ok) {
          throw new Error("Feedback generation failed");
        }

        const feedbackData = feedbackResponse.body;
        if (!feedbackData) {
          throw new Error("No feedback data received");
        }

        // Stream the feedback response
        const reader = feedbackData.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let feedbackText = "";

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          const chunkValue = decoder.decode(value);
          feedbackText += chunkValue;
        }

        // Update state with the response and feedback
        setResponses((prev) => [...prev, transcriptText]);
        setFeedbacks((prev) => [...prev, feedbackText]);

        // Move to the next question or complete the interview
        handleNextQuestion();

        // Reset video and UI for the next question
        restartVideo();
      } catch (error) {
        console.error("Error in handleDownload:", error);
        setStatus("Failed");
        setIsSuccess(false);
      } finally {
        setSubmitting(false);
        setTimeout(() => {
          setRecordedChunks([]); // Clear recorded chunks after processing
        }, 1500);
      }
    }
  };

  function restartVideo() {
    setRecordedChunks([]);
    setVideoEnded(false);
    setCapturing(false);
    setIsVisible(true);
    setSeconds(150);
    setIsSuccess(false);
  }

  const videoConstraints = isDesktop
    ? { width: 1280, height: 720, facingMode: "user" }
    : { width: 480, height: 640, facingMode: "user" };

  const handleUserMedia = () => {
    setTimeout(() => {
      setLoading(false);
      setCameraLoaded(true);
    }, 1000);
  };

  const generateOverallFeedback = async (feedbacks: string[], prompts: string[]) => {
    const feedbackSummary = feedbacks.map((feedback, index) => {
      return `Question ${index + 1}: ${prompts[index]}\nFeedback: ${feedback}\n`;
    }).join("\n");

    const prompt = `
      You are an expert career coach analyzing a candidate's performance in a mock interview. Below is the feedback for each question the candidate answered:
  
      ---
      ${feedbackSummary}
      ---
  
      Based on the feedback above, provide an overall evaluation of the candidate's performance. Include the following:
      1. Strengths: What did the candidate do well across all responses? If none is found, mention that.
      2. Weaknesses: What areas need improvement?
      3. Suggestions: Provide actionable advice for the candidate to improve their interview skills.
      4. Overall Assessment: Summarize the candidate's performance in one or two sentences.
      5. Score: Provide a score out of 10 based on their performance. Consider factors like clarity, relevance, communication skills, and technical accuracy (if applicable). The score should be displayed as "Score: X/10". Be very critical with your evaluation.
  
      Ensure the feedback is constructive, professional, and tailored to help the candidate improve. The scoring and feedback should be strict
    `;

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) throw new Error(response.statusText);

    const data = response.body;
    if (!data) return { feedback: "", score: 0 };

    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let overallFeedback = "";

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      overallFeedback += chunkValue;
    }

    const scoreMatch = overallFeedback.match(/Score:\s*(\d+)\/10/) || overallFeedback.match(/a (\d+) out of 10/);
    console.log("Scorematch:", scoreMatch);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    console.log("Score:", score);

    const formattedFeedback = overallFeedback.replace(/\*\*/g, "");

    return { feedback: formattedFeedback, score };
  };

  useEffect(() => {
    if (completed) {
      const fetchOverallFeedback = async () => {
        const { feedback, score } = await generateOverallFeedback(feedbacks, selected.prompts);
        setOverallFeedback(feedback);
        setOverallScore(score);
      };

      fetchOverallFeedback();
    }
  }, [completed, feedbacks, selected.prompts]);

  return (
    <AnimatePresence>
      {step === 3 ? (
        <div className="w-full min-h-screen flex flex-col px-4 pt-2 pb-8 md:px-8 md:py-2 bg-[#FCFCFC] relative overflow-x-hidden">
          {completed ? (
            <div className="w-full flex flex-col max-w-[1080px] mx-auto mt-[10vh] overflow-y-auto pb-8 md:pb-12">
              {selected.prompts.map((question, index) => (
                <motion.div
                  key={question}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.5,
                    duration: 0.15,
                    ease: [0.23, 1, 0.82, 1],
                  }}
                  className="mt-8 flex flex-col p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:shadow-lg"
                >
                  <div>
                    <h2 className="text-2xl font-bold text-[#1D2B3A] dark:text-white mb-3">
                      ❓ Question {index + 1}
                    </h2>
                    <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                      {selected.prompts[index]}
                    </p>
                  </div>
                  <div className="mt-6">
                    <h2 className="text-2xl font-bold text-[#1D2B3A] dark:text-white mb-3">
                      📝 Your Response
                    </h2>
                    <p className="text-lg text-gray-800 dark:text-gray-300 leading-relaxed">
                      {responses[index]}
                    </p>
                  </div>
                  <div className="mt-6">
                    <h2 className="text-2xl font-bold text-[#1D2B3A] dark:text-white mb-3">
                      ✅ Feedback
                    </h2>
                    <div className="text-lg flex gap-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 p-4 leading-7 text-gray-900 dark:text-gray-200 min-h-[100px]">
                      <p className="leading-relaxed">{feedbacks[index]}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
              {completed && (
                <div className="mt-8 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6">
                  <h2 className="text-2xl font-bold text-[#1D2B3A] dark:text-white mb-3">
                    🎯 Overall Feedback
                  </h2>
                  <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-md">
                    {overallFeedback.split("\n").map((line, index) => (
                      <p key={index} className="text-gray-700 dark:text-gray-200 leading-relaxed">
                        {line}
                      </p>
                    ))}
                  </div>

                  <h2 className="text-2xl font-bold text-[#1D2B3A] dark:text-white mt-6 mb-3">
                    🌟 Overall Score
                  </h2>
                  <div className="flex items-center justify-center bg-blue-500 text-white font-bold text-3xl p-4 rounded-lg shadow-md">
                    {overallScore} / 10
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="h-full w-full items-center flex flex-col mt-[10vh]">
              {recordingPermission ? (
                <div className="w-full flex flex-col max-w-[1080px] mx-auto justify-center">

                  {isLoadingNextQuestion ? (
                    <div className="flex items-center justify-center">
                      <svg
                        className="animate-spin h-5 w-5 text-[#1D2B3A] mx-auto my-0.5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth={3}
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span className="ml-2">Generating next question...</span>
                    </div>
                  ) : (
                    <>

                      <h2 className="text-2xl font-semibold text-left text-[#1D2B3A] mb-2">
                        {selected.prompts[currentQuestionIndex]}
                      </h2>
                      <motion.div
                        initial={{ y: -20 }}
                        animate={{ y: 0 }}
                        transition={{
                          duration: 0.35,
                          ease: [0.075, 0.82, 0.965, 1],
                        }}
                        className="relative aspect-[16/9] w-full max-w-[1080px] overflow-hidden bg-[#1D2B3A] rounded-lg ring-1 ring-gray-900/5 shadow-md"
                      >
                        {!cameraLoaded && (
                          <div className="text-white absolute top-1/2 left-1/2 z-20 flex items-center">
                            <svg
                              className="animate-spin h-4 w-4 text-white mx-auto my-0.5"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth={3}
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                          </div>
                        )}
                        <div className="relative z-10 h-full w-full rounded-lg">
                          <div className="absolute top-5 lg:top-10 left-5 lg:left-10 z-20">
                            <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-800">
                              {new Date(seconds * 1000).toISOString().slice(14, 19)}
                            </span>
                          </div>
                          {isVisible && (
                            <div className="block absolute top-[10px] sm:top-[20px] lg:top-[40px] left-auto right-[10px] sm:right-[20px] md:right-10 h-[80px] sm:h-[140px] md:h-[180px] aspect-video rounded z-20">
                              <div className="h-full w-full aspect-video rounded md:rounded-lg lg:rounded-xl">
                                <video
                                  id="question-video"
                                  onEnded={handleVideoEnd}
                                  controls={false}
                                  ref={vidRef}
                                  playsInline
                                  className="h-full object-cover w-full rounded-md md:rounded-[12px] aspect-video"
                                  crossOrigin="anonymous"
                                >
                                  <source
                                    src={videoSources1[1]}
                                    type="video/mp4"
                                  />
                                </video>
                              </div>
                            </div>
                          )}
                          <Webcam
                            mirrored
                            audio
                            muted
                            ref={webcamRef}
                            videoConstraints={videoConstraints}
                            onUserMedia={handleUserMedia}
                            onUserMediaError={(error) => {
                              setRecordingPermission(false);
                            }}
                            className="absolute z-10 min-h-[100%] min-w-[100%] h-auto w-auto object-cover"
                          />
                        </div>
                        {loading && (
                          <div className="absolute flex h-full w-full items-center justify-center">
                            <div className="relative h-[112px] w-[112px] rounded-lg object-cover text-[2rem]">
                              <div className="flex h-[112px] w-[112px] items-center justify-center rounded-[0.5rem] bg-[#4171d8] !text-white">
                                Loading...
                              </div>
                            </div>
                          </div>
                        )}

                        {cameraLoaded && (
                          <div className="absolute bottom-0 left-0 z-50 flex h-[82px] w-full items-center justify-center">
                            {recordedChunks.length > 0 ? (
                              <>
                                {isSuccess ? (
                                  <button
                                    className="cursor-disabled group rounded-full min-w-[140px] px-4 py-2 text-[13px] font-semibold group inline-flex items-center justify-center text-sm text-white duration-150 bg-green-500 hover:bg-green-600 hover:text-slate-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 active:scale-100 active:bg-green-800 active:text-green-100"
                                    style={{
                                      boxShadow:
                                        "0px 1px 4px rgba(27, 71, 13, 0.17), inset 0px 0px 0px 1px #5fc767, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                                    }}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-5 w-5 mx-auto"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <motion.path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        transition={{ duration: 0.5 }}
                                      />
                                    </svg>
                                  </button>
                                ) : (
                                  <div className="flex flex-row gap-2">
                                    {!isSubmitting && (
                                      <button
                                        onClick={() => restartVideo()}
                                        className="group rounded-full px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-white text-[#1E2B3A] hover:[linear-gradient(0deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), #0D2247] no-underline flex gap-x-2  active:scale-95 scale-100 duration-75"
                                      >
                                        Restart
                                      </button>
                                    )}
                                    <button
                                      onClick={handleDownload}
                                      disabled={isSubmitting}
                                      className="group rounded-full min-w-[140px] px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#1E2B3A] text-white hover:[linear-gradient(0deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), #0D2247] no-underline flex  active:scale-95 scale-100 duration-75  disabled:cursor-not-allowed"
                                      style={{
                                        boxShadow:
                                          "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                                      }}
                                    >
                                      <span>
                                        {isSubmitting ? (
                                          <div className="flex items-center justify-center gap-x-2">
                                            <svg
                                              className="animate-spin h-5 w-5 text-slate-50 mx-auto"
                                              xmlns="http://www.w3.org/2000/svg"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                            >
                                              <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth={3}
                                              ></circle>
                                              <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                              ></path>
                                            </svg>
                                            <span>{status}</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-center gap-x-2">
                                            <span>Process transcript</span>
                                            <svg
                                              className="w-5 h-5"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <path
                                                d="M13.75 6.75L19.25 12L13.75 17.25"
                                                stroke="white"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                              />
                                              <path
                                                d="M19 12H4.75"
                                                stroke="white"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                              />
                                            </svg>
                                          </div>
                                        )}
                                      </span>
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="absolute bottom-[6px] md:bottom-5 left-5 right-5">
                                <div className="lg:mt-4 flex flex-col items-center justify-center gap-2">
                                  {capturing ? (
                                    <div
                                      id="stopTimer"
                                      onClick={handleStopCaptureClick}
                                      className="flex h-10 w-10 flex-col items-center justify-center rounded-full bg-transparent text-white hover:shadow-xl ring-4 ring-white  active:scale-95 scale-100 duration-75 cursor-pointer"
                                    >
                                      <div className="h-5 w-5 rounded bg-red-500 cursor-pointer"></div>
                                    </div>
                                  ) : (
                                    <button
                                      id="startTimer"
                                      onClick={handleStartCaptureClick}
                                      className="flex h-8 w-8 sm:h-8 sm:w-8 flex-col items-center justify-center rounded-full bg-red-500 text-white hover:shadow-xl ring-4 ring-white ring-offset-gray-500 ring-offset-2 active:scale-95 scale-100 duration-75"
                                    ></button>
                                  )}
                                  <div className="w-12"></div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <div
                          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 text-5xl text-white font-semibold text-center"
                          id="countdown"
                        ></div>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.5,
                          duration: 0.15,
                          ease: [0.23, 1, 0.82, 1],
                        }}
                        className="flex flex-row space-x-1 mt-4 items-center"
                      >
                      </motion.div>
                    </>
                  )}
                </div>
              ) : (
                <div className="w-full flex flex-col max-w-[1080px] mx-auto justify-center">
                  <motion.div
                    initial={{ y: 20 }}
                    animate={{ y: 0 }}
                    transition={{
                      duration: 0.35,
                      ease: [0.075, 0.82, 0.165, 1],
                    }}
                    className="relative md:aspect-[16/9] w-full max-w-[1080px] overflow-hidden bg-[#1D2B3A] rounded-lg ring-1 ring-gray-900/5 shadow-md flex flex-col items-center justify-center"
                  >
                    <p className="text-white font-medium text-lg text-center max-w-3xl">
                      Camera permission is denied. Try again after enabling permissions in your
                      browser settings.
                    </p>
                  </motion.div>
                  <div className="flex flex-row space-x-4 mt-8 justify-end">
                    <button
                      onClick={() => setStep(1)}
                      className="group max-w-[200px] rounded-full px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#f5f7f9] text-[#1E2B3A] no-underline active:scale-95 scale-100 duration-75"
                      style={{
                        boxShadow: "0 1px 1px #0c192714, 0 1px 3px #0c192724",
                      }}
                    >
                      Go Back
                    </button>

                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : step === 2 ? (
        <div className="flex flex-col md:flex-row w-full md:overflow-hidden">
          <div className="w-full min-h-[60vh] md:w-1/2 md:h-screen flex flex-col px-4 pt-2 pb-8 md:px-0 md:py-2 bg-[#FCFCFC] justify-center">
            <div className="h-full w-full items-center justify-center flex flex-col">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                key="step-2"
                transition={{
                  duration: 0.95,
                  ease: [0.165, 0.84, 0.44, 1],
                }}
                className="max-w-lg mx-auto px-4 lg:px-0"
              >
                <h2 className="text-4xl font-bold text-[#1E2B3A]">
                  Select a topic
                </h2>
                <p className="text-[14px] leading-[20px] text-[#1a2b3b] font-normal my-4">
                  Choose a specific topic to practice
                </p>
                <div>
                  <RadioGroup value={selectedTopic} onChange={setSelectedTopic}>
                    <RadioGroup.Label className="sr-only">
                      Topic
                    </RadioGroup.Label>
                    <div className="space-y-4">
                      {selected.topics.map((topic) => (
                        <RadioGroup.Option
                          key={topic.id}
                          value={topic}
                          className={({ checked, active }) =>
                            classNames(
                              checked
                                ? "border-transparent"
                                : "border-gray-300",
                              active
                                ? "border-blue-500 ring-2 ring-blue-200"
                                : "",
                              "relative cursor-pointer rounded-lg border bg-white px-6 py-4 shadow-sm focus:outline-none flex justify-between"
                            )
                          }
                        >
                          {({ active, checked }) => (
                            <>
                              <span className="flex items-center">
                                <span className="flex flex-col text-sm">
                                  <RadioGroup.Label
                                    as="span"
                                    className="font-medium text-gray-900"
                                  >
                                    {topic.name}
                                  </RadioGroup.Label>
                                </span>
                              </span>
                              <span
                                className={classNames(
                                  active ? "border" : "border-2",
                                  checked
                                    ? "border-blue-500"
                                    : "border-transparent",
                                  "pointer-events-none absolute -inset-px rounded-lg"
                                )}
                                aria-hidden="true"
                              />
                            </>
                          )}
                        </RadioGroup.Option>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
                <div className="flex gap-[15px] justify-end mt-8">
                  <div>
                    <button
                      onClick={() => setStep(1)}
                      className="group rounded-full px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#f5f7f9] text-[#1E2B3A] no-underline active:scale-95 scale-100 duration-75"
                      style={{
                        boxShadow: "0 1px 1px #0c192714, 0 1px 3px #0c192724",
                      }}
                    >
                      Back
                    </button>
                  </div>
                  <div>
                    <button
                      onClick={() => setStep(3)}
                      disabled={!selectedTopic}
                      className="group rounded-full px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#1E2B3A] text-white hover:[linear-gradient(0deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), #0D2247] no-underline flex gap-x-2  active:scale-95 scale-100 duration-75 disabled:opacity-50"
                      style={{
                        boxShadow:
                          "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <span> Continue </span>
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M13.75 6.75L19.25 12L13.75 17.25"
                          stroke="#FFF"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M19 12H4.75"
                          stroke="#FFF"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
          <div className="w-full h-[40vh] md:w-1/2 md:h-screen bg-[#F1F2F4] relative overflow-hidden">
            <div
              className="absolute md:top-1/2 left-1/2 transform -translate-x-1/2 md:-mt-[240px] ml-[-380px] md:ml-0 scale-[0.5] sm:scale-[0.6] md:scale-[130%] w-[450px] h-[420px] bg-[#f5f7f9] text-[9px] origin-[50%_15%] md:origin-[50%_25%] rounded-[15px] overflow-hidden p-2 z-20 shadow-lg"
              style={{
                grid: "100%/repeat(1,calc(5px * 28)) 1fr",
                boxShadow:
                  "0 192px 136px rgba(26,43,59,.23),0 70px 50px rgba(26,43,59,.16),0 34px 24px rgba(26,43,59,.13),0 17px 12px rgba(26,43,59,.1),0 7px 5px rgba(26,43,59,.07), 0 50px 100px -20px rgb(50 50 93 / 25%), 0 30px 60px -30px rgb(0 0 0 / 30%), inset 0 -2px 6px 0 rgb(10 37 64 / 35%)",
              }}
            >
              <img
                src="/qnmark.png"
                alt="Full image"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row w-full md:overflow-hidden">
          <div className="w-full min-h-[60vh] md:w-1/2 md:h-screen flex flex-col px-4 pt-2 pb-8 md:px-0 md:py-2 bg-[#FCFCFC] justify-center">
            <div className="h-full w-full items-center justify-center flex flex-col">
              {step === 1 ? (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40 }}
                  key="step-1"
                  transition={{
                    duration: 0.95,
                    ease: [0.165, 0.84, 0.44, 1],
                  }}
                  className="max-w-lg mx-auto px-4 lg:px-0"
                >
                  <h2 className="text-4xl font-bold text-[#1E2B3A]">
                    Select a question type
                  </h2>
                  <p className="text-[14px] leading-[20px] text-[#1a2b3b] font-normal my-4">
                    Hone your interview skills with AcePrep
                  </p>
                  <div>
                    <RadioGroup value={selected} onChange={setSelected}>
                      <RadioGroup.Label className="sr-only">
                        Server size
                      </RadioGroup.Label>
                      <div className="space-y-4">
                        {questions.map((question) => (
                          <RadioGroup.Option
                            key={question.name}
                            value={question}
                            className={({ checked, active }) =>
                              classNames(
                                checked
                                  ? "border-transparent"
                                  : "border-gray-300",
                                active
                                  ? "border-blue-500 ring-2 ring-blue-200"
                                  : "",
                                "relative cursor-pointer rounded-lg border bg-white px-6 py-4 shadow-sm focus:outline-none flex justify-between"
                              )
                            }
                          >
                            {({ active, checked }) => (
                              <>
                                <span className="flex items-center">
                                  <span className="flex flex-col text-sm">
                                    <RadioGroup.Label
                                      as="span"
                                      className="font-medium text-gray-900"
                                    >
                                      {question.name}
                                    </RadioGroup.Label>
                                    <RadioGroup.Description
                                      as="span"
                                      className="text-gray-500"
                                    >
                                      <span className="block">
                                        {question.description}
                                      </span>
                                    </RadioGroup.Description>
                                  </span>
                                </span>
                                <RadioGroup.Description
                                  as="span"
                                  className="flex text-sm ml-4 mt-0 flex-col text-right items-center justify-center"
                                >
                                  <span className=" text-gray-500">
                                    {question.difficulty === "Easy" ? (
                                      <svg
                                        className="h-full w-[16px]"
                                        viewBox="0 0 22 25"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <rect
                                          y="13.1309"
                                          width="6"
                                          height="11"
                                          rx="1"
                                          fill="#4E7BBA"
                                        />
                                        <rect
                                          x="8"
                                          y="8.13086"
                                          width="6"
                                          height="16"
                                          rx="1"
                                          fill="#E1E1E1"
                                        />
                                        <rect
                                          x="16"
                                          y="0.130859"
                                          width="6"
                                          height="24"
                                          rx="1"
                                          fill="#E1E1E1"
                                        />
                                      </svg>
                                    ) : (
                                      <svg
                                        className="h-full w-[16px]"
                                        viewBox="0 0 22 25"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <rect
                                          y="13.1309"
                                          width="6"
                                          height="11"
                                          rx="1"
                                          fill="#4E7BBA"
                                        />
                                        <rect
                                          x="8"
                                          y="8.13086"
                                          width="6"
                                          height="16"
                                          rx="1"
                                          fill="#4E7BBA"
                                        />
                                        <rect
                                          x="16"
                                          y="0.130859"
                                          width="6"
                                          height="24"
                                          rx="1"
                                          fill="#E1E1E1"
                                        />
                                      </svg>
                                    )}
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {question.difficulty}
                                  </span>
                                </RadioGroup.Description>
                                <span
                                  className={classNames(
                                    active ? "border" : "border-2",
                                    checked
                                      ? "border-blue-500"
                                      : "border-transparent",
                                    "pointer-events-none absolute -inset-px rounded-lg"
                                  )}
                                  aria-hidden="true"
                                />
                              </>
                            )}
                          </RadioGroup.Option>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex gap-[15px] justify-end mt-8">
                    <div>
                      <Link
                        href="/"
                        className="group rounded-full px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#f5f7f9] text-[#1E2B3A] no-underline active:scale-95 scale-100 duration-75"
                        style={{
                          boxShadow: "0 1px 1px #0c192714, 0 1px 3px #0c192724",
                        }}
                      >
                        Back to home
                      </Link>
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          setStep(2);
                        }}
                        className="group rounded-full px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#1E2B3A] text-white hover:[linear-gradient(0deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), #0D2247] no-underline flex gap-x-2  active:scale-95 scale-100 duration-75"
                        style={{
                          boxShadow:
                            "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <span> Continue </span>
                        <svg
                          className="w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M13.75 6.75L19.25 12L13.75 17.25"
                            stroke="#FFF"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M19 12H4.75"
                            stroke="#FFF"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <p>Step 3</p>
              )}
            </div>
          </div>
          <div className="w-full h-[40vh] md:w-1/2 md:h-screen bg-[#F1F2F4] relative overflow-hidden">
            <div
              className="absolute md:top-1/2 left-1/2 transform -translate-x-1/2 md:-mt-[240px] ml-[-380px] md:ml-0 scale-[0.5] sm:scale-[0.6] md:scale-[130%] w-[450px] h-[420px] bg-[#f5f7f9] text-[9px] origin-[50%_15%] md:origin-[50%_25%] rounded-[15px] overflow-hidden p-2 z-20 shadow-lg"
              style={{
                grid: "100%/repeat(1,calc(5px * 28)) 1fr",
                boxShadow:
                  "0 192px 136px rgba(26,43,59,.23),0 70px 50px rgba(26,43,59,.16),0 34px 24px rgba(26,43,59,.13),0 17px 12px rgba(26,43,59,.1),0 7px 5px rgba(26,43,59,.07), 0 50px 100px -20px rgb(50 50 93 / 25%), 0 30px 60px -30px rgb(0 0 0 / 30%), inset 0 -2px 6px 0 rgb(10 37 64 / 35%)",
              }}
            >
              <img
                src="/qnmark.png"
                alt="Full image"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}