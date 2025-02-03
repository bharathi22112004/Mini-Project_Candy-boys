const webcam = document.getElementById("webcam");
const startButton = document.getElementById("start-recording");
const stopButton = document.getElementById("stop-recording");
const questionElement = document.getElementById("question");
const audioPlayback = document.getElementById("audio-playback");
const feedbackText = document.getElementById("feedback-text");

let mediaRecorder;
let audioChunks = [];

// Fetch a new question from the backend
async function fetchNewQuestion() {
    try {
        const response = await fetch("http://localhost:5000/get-questions");
        const data = await response.json();
        questionElement.textContent = data.question;
    } catch (error) {
        console.error("Error fetching question:", error);
        questionElement.textContent = "Failed to load a question. Please try again.";
    }
}

// Start the webcam
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
        webcam.srcObject = stream;

        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
            const audioURL = URL.createObjectURL(audioBlob);
            audioPlayback.src = audioURL;
            audioPlayback.hidden = false;

            // Send audio to backend
            const formData = new FormData();
            formData.append("audio", audioBlob);

            try {
                const audioResponse = await fetch("http://localhost:5000/analyze-audio", {
                    method: "POST",
                    body: formData
                });
                const audioFeedback = await audioResponse.json();

                // Capture frame and analyze
                const videoFrame = captureFrame();
                const response = await fetch("http://localhost:5000/analyze-face", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ frame: videoFrame })
                });

                const videoFeedback = await response.json();

                const finalResponse = await fetch("http://localhost:5000/get-feedback", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        face_data: videoFeedback,
                        audio_data: audioFeedback
                    })
                });

                const feedback = await finalResponse.json();
                feedbackText.textContent = feedback.overall;
            } catch (error) {
                console.error("Error during feedback analysis:", error);
            }
        };
    })
    .catch((error) => {
        console.error("Error accessing media devices:", error);
        alert("Please enable your webcam and microphone!");
    });

// Capture video frame
function captureFrame() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = webcam.videoWidth;
    canvas.height = webcam.videoHeight;
    context.drawImage(webcam, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg");
}

// Button functionality
startButton.addEventListener("click", () => {
    mediaRecorder.start();
    audioChunks = [];
    startButton.disabled = true;
    stopButton.disabled = false;
});

stopButton.addEventListener("click", () => {
    mediaRecorder.stop();
    startButton.disabled = false;
    stopButton.disabled = true;

    // Fetch a new question
    fetchNewQuestion();
});

// Load the first question
fetchNewQuestion();
