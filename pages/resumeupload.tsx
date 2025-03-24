import { useState } from "react";
import { AiOutlineUpload, AiOutlineCheckCircle, AiOutlineLoading3Quarters, AiOutlineDownload } from "react-icons/ai";
import { FiX } from "react-icons/fi";

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
    setFeedback(result.feedback.split("\n"));
    setLoading(false);
    setUploaded(true);
  };

  const handleRemoveFile = () => {
    setFile(null);
  };

  const downloadResults = () => {
    // Create a text blob with the feedback
    const reportHeader = `Resume Analysis Report\nDate: ${new Date().toLocaleDateString()}\n\n`;
    const fileInfo = `Original File: ${file?.name}\nFile Size: ${(file?.size && (file.size / 1024 / 1024).toFixed(2)) || '0'} MB\n\n`;
    const feedbackText = feedback.join("\n\n");
    const nextSteps = "\n\nNext Steps:\nImplement these suggestions to strengthen your resume and increase your chances of landing interviews.";
    
    const fullReport = reportHeader + fileInfo + "Key Findings:\n" + feedbackText + nextSteps;
    
    const blob = new Blob([fullReport], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume_feedback_report.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="flex flex-col items-center gap-6 p-8 bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md">
        {!uploaded ? (
          <>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                Resume Analyzer
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Get personalized feedback to improve your resume
              </p>
            </div>

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
              className={`w-full p-8 border-2 ${
                dragging 
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                  : "border-dashed border-gray-300 dark:border-gray-600"
              } rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-200`}
            >
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                <AiOutlineUpload className="text-3xl text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-gray-600 dark:text-gray-300 font-medium mb-1">
                Drag & drop your resume
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                or click to browse files
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Supported formats: PDF, DOC, DOCX
              </p>
              <input 
                type="file" 
                accept=".pdf,.doc,.docx" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </label>

            {/* File Preview */}
            {file && (
              <div className="w-full flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-200 dark:bg-gray-600 rounded">
                    <AiOutlineUpload className="text-gray-600 dark:text-gray-300" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[180px]">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleRemoveFile}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <FiX className="text-lg" />
                </button>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className={`w-full py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                loading
                  ? "bg-blue-500 hover:bg-blue-600"
                  : file
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
              } text-white font-medium shadow-md hover:shadow-lg`}
            >
              {loading ? (
                <>
                  <AiOutlineLoading3Quarters className="animate-spin text-xl" />
                  Analyzing...
                </>
              ) : (
                "Analyze Resume"
              )}
            </button>
          </>
        ) : (
          <div className="w-full animate-fadeIn">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                <AiOutlineCheckCircle className="text-green-600 dark:text-green-400 text-2xl" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
                Resume Analysis Report
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {new Date().toLocaleDateString()}
              </p>
            </div>

            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-2">
                Original File: {file?.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {(file?.size && (file.size / 1024 / 1024).toFixed(2)) || '0'} MB
              </p>
            </div>

            <div className="space-y-2 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white border-b pb-2">
                Key Findings
              </h3>
              {feedback.map((point, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 p-4 ${
                    point.startsWith("✅") 
                      ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                      : "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-green-800"
                  } text-gray-800 dark:text-gray-100 rounded-lg border transition-all duration-200`}
                >
                  {point.startsWith("✅") ? (
                    <AiOutlineCheckCircle className="text-green-500 text-lg mt-0.5 flex-shrink-0" />
                  ) : (
                    <></>
                  )}
                  <p className="text-sm leading-relaxed">
                    {point.replace(/^[✅⚠️]\s*/, '')}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setUploaded(false);
                  setFile(null);
                  setFeedback([]);
                }}
                className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Analyze Another
              </button>
              <button
                onClick={downloadResults}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <AiOutlineDownload />
                Download Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeUpload;