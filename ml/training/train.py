import pandas as pd
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

fake = pd.read_csv('ml/training/Fake.csv')
true = pd.read_csv('ml/training/True.csv')

fake['label'] = 0
true['label'] = 1

data = pd.concat([fake, true])

X = data['text']
y = data['label']

vectorizer = TfidfVectorizer(stop_words='english')
X_vec = vectorizer.fit_transform(X)

model = LogisticRegression()
model.fit(X_vec, y)

joblib.dump((model, vectorizer), 'ml/model/model.pkl')

print("Model trained and saved!")
