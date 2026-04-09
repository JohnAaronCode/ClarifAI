from flask import Flask, request, jsonify
import joblib
import os

app = Flask(__name__)

# Load model once on startup
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "model.pkl")
model, vectorizer = joblib.load(MODEL_PATH)


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()

    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400

    text = data["text"]

    if not isinstance(text, str) or len(text.strip()) < 10:
        return jsonify({"error": "Text too short"}), 400

    text_vec = vectorizer.transform([text])
    prediction = model.predict(text_vec)[0]
    proba = model.predict_proba(text_vec)[0] if hasattr(
        model, "predict_proba") else None

    label = "REAL" if prediction == 1 else "FAKE"
    confidence = None

    if proba is not None:
        # Index 1 = REAL, Index 0 = FAKE
        confidence = round(
            float(proba[1]) * 100, 1) if label == "REAL" else round(float(proba[0]) * 100, 1)

    return jsonify({
        "verdict": label,
        "confidence": confidence,
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
