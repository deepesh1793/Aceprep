import { useState } from "react";
import { AiOutlineUpload, AiOutlineCheckCircle, AiOutlineLoading3Quarters } from "react-icons/ai";

const ResumeUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return alert("Please upload a resume file!");

    setLoading(true);
    setFeedback([]);
    setUploaded(false);

    const formData = new FormData();
    formData.append("resume", file);

    const response = await fetch("/api/upload-resume", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    setFeedback(result.feedback.split("\n")); // Assuming feedback is newline-separated
    setLoading(false);
    setUploaded(true);
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-gray-800">
      <div className="flex flex-col items-center gap-6 p-8 bg-white dark:bg-gray-800 shadow-xl rounded-2xl border border-gray-300 dark:border-gray-700 transition-all duration-300 hover:shadow-2xl w-full max-w-lg">
        
        {!uploaded ? (
          <>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">📄 Upload Your Resume</h2>

            {/* Drag-and-Drop File Upload */}
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setFile(e.dataTransfer.files[0]);
                setDragging(false);
              }}
              className={`w-full p-6 border-2 ${
                dragging ? "border-blue-500 bg-blue-100" : "border-dashed border-gray-400"
              } rounded-lg flex flex-col items-center cursor-pointer transition-all duration-200`}
            >
              <AiOutlineUpload className="text-4xl text-gray-500" />
              <p className="text-gray-600 dark:text-gray-300 mt-2">Drag & drop or click to upload</p>
              <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
              {file && <p className="mt-2 font-medium text-blue-600">{file.name}</p>}
            </label>

            {/* Upload Button with Loading Effect */}
            <button
              onClick={handleUpload}
              className={`px-6 py-3 rounded-lg transition-all duration-300 w-full flex items-center justify-center gap-2 ${
                loading
                  ? "bg-yellow-500 hover:bg-yellow-600"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white text-lg font-medium`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <AiOutlineLoading3Quarters className="animate-spin text-xl" />
                  Uploading...
                </>
              ) : (
                "Upload Resume"
              )}
            </button>
          </>
        ) : (
          <div className="animate-fadeIn w-full text-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center justify-center gap-2">
              <AiOutlineCheckCircle className="text-green-600 text-3xl" />
              Resume Analysis
            </h2>

            <div className="mt-6 space-y-4 w-full">
              {feedback.map((point, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg shadow-md transition-all duration-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <AiOutlineCheckCircle className="text-green-600 text-xl" />
                  <p className="text-sm leading-relaxed">{point}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setUploaded(false);
                setFile(null);
                setFeedback([]);
              }}
              className="mt-6 px-5 py-3 text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-all"
            >
              Upload Another Resume
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeUpload;
