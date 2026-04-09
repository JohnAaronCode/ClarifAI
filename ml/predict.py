import sys
import joblib

model, vectorizer = joblib.load('ml/model/model.pkl')

text = sys.argv[1]

text_vec = vectorizer.transform([text])
prediction = model.predict(text_vec)[0]

label = "REAL" if prediction == 1 else "FAKE"

print(label)
