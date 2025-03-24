import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createWorker } from "tesseract.js";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { createCanvas } from "canvas";

export default function ResumeUpload() {
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [jobDescription, setJobDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null); // State for error messages
    const router = useRouter();

    // Set the worker source for PDF.js
    useEffect(() => {
        GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;
    }, []);

    // Handle file input change
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];

            // Validate file type
            if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
                setError("Please upload an image file (PNG, JPEG, BMP) or a PDF.");
                return;
            }

            setResumeFile(file);
            setError(null); // Clear any previous errors
        }
    };

    const handleQuestionsGenerated = (questions: string[]) => {
        sessionStorage.setItem('resumeQuestions', JSON.stringify(questions));
        router.push('/demo');
    };

    // Extract images from a PDF file
    const extractImagesFromPDF = async (file: File) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await getDocument({ data: arrayBuffer }).promise;
            const images = [];

            // Loop through each page of the PDF
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext("2d");

                // Render the page to the canvas
                await page.render({ canvasContext: context, viewport }).promise;

                // Convert the canvas to a data URL (PNG image)
                const imageData = canvas.toDataURL("image/png");
                images.push(imageData);
            }

            return images;
        } catch (error) {
            console.error("Error extracting images from PDF:", error);
            throw new Error("Failed to extract images from PDF.");
        }
    };

    // Extract text from an array of images using Tesseract.js
    const extractTextFromImages = async (images: string[]) => {
        const worker = await createWorker();

        try {
            let extractedText = "";

            // Loop through each image and extract text
            for (const image of images) {
                const { data } = await worker.recognize(image, "eng"); // Specify language here
                extractedText += data.text + "\n";
            }

            return extractedText;
        } catch (error) {
            console.error("Error extracting text from images:", error);
            throw new Error("Failed to extract text from images.");
        } finally {
            // Terminate the worker to free up resources
            await worker.terminate();
        }
    };

    // Extract text from an image file using Tesseract.js
    const extractTextFromResume = async (file: File) => {
        const worker = await createWorker();

        try {
            await worker.loadLanguage("eng");
            await worker.initialize("eng");
            const { data } = await worker.recognize(file);
            return data.text;
        } catch (error) {
            console.error("Error extracting text from resume:", error);
            throw new Error("Failed to extract text from resume.");
        } finally {
            await worker.terminate();
        }
    };

    // Extract keywords from text using a simple regex
    const extractKeywords = (text: string): string[] => {
        return [...new Set(text.match(/\b\w{4,}\b/g) || [])];
    };

    // Generate interview questions using the Groq API
    const generateQuestions = async (keywords: string[], jobDesc: string) => {
        try {
            const response = await fetch("/api/generate-llama", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: `Generate 5 random interview questions based on these keywords: ${keywords.join(", ")} for this job description: ${jobDesc}. Exclude any questions related to schooling and educational background. Only return the questions, without any introductory or concluding statements.`,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text(); // Read the error response
                console.error("API Error Response:", errorText);
                throw new Error(`Failed to generate questions: ${errorText}`);
            }

            const data = await response.json();
            return data.questions;
        } catch (error) {
            console.error("Error generating questions:", error);
            throw new Error("Failed to generate questions.");
        }
    };

    // Handle form submission
    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!resumeFile || !jobDescription) {
            setError("Please upload a resume and enter a job description.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let extractedText = "";

            if (resumeFile.type === "application/pdf") {
                const images = await extractImagesFromPDF(resumeFile);
                extractedText = await extractTextFromImages(images);
            } else if (resumeFile.type.startsWith("image/")) {
                extractedText = await extractTextFromResume(resumeFile);
            } else {
                throw new Error("Unsupported file format.");
            }

            const keywords = extractKeywords(extractedText);
            const allQuestions = await generateQuestions(keywords, jobDescription);

            // Ensure allQuestions is a string before processing
            if (typeof allQuestions !== "string") {
                console.error("Error: Generated questions must be a string.");
                setError("Invalid question format. Please try again.");
                setLoading(false);
                return;
            }

            // Convert the string of questions into an array
            const questionsArray = allQuestions
                .split("\n") // Split by newlines to separate each question
                .map((q) => q.trim()) // Trim whitespace
                .filter((question) => question !== ""); // Remove empty lines

            // Filter out "Introduction and Background" questions (case-insensitive)
            const filteredQuestions = questionsArray
                .filter((question: string, index: number) => index !== 0) // Skip first element
                .filter((question: string) => {
                    const lowerCaseQuestion = question.toLowerCase();
                    return !(
                        lowerCaseQuestion.includes("educational background") ||
                        lowerCaseQuestion.includes("schooling experience") ||
                        lowerCaseQuestion.includes("motivated you to pursue")
                    );
                });

            // Print the filtered questions to the console
            console.log("Filtered Questions:", filteredQuestions);

            // Call handleQuestionsGenerated with the filtered questions
            handleQuestionsGenerated(filteredQuestions);

        } catch (error) {
            console.error("Error processing resume:", error);
            setError("An error occurred while processing your resume. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#FCFCFC] p-4">
            <h1 className="text-2xl font-bold mb-4">Upload Your Resume</h1>
            <form onSubmit={handleSubmit} className="w-full max-w-md">
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Resume (PDF or Image)</label>
                    <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.bmp"
                        onChange={handleFileChange}
                        className="w-full p-2 border rounded"
                        required
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Job Description</label>
                    <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        className="w-full p-2 border rounded"
                        rows={4}
                        required
                    />
                </div>
                {error && <p className="text-red-500 text-sm mb-4">{error}</p>} {/* Display error message */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#1E2B3A] text-white p-2 rounded hover:bg-[#0D2247] transition-all"
                >
                    {loading ? "Processing..." : "Generate Questions"}
                </button>
            </form>
        </div>
    );
}