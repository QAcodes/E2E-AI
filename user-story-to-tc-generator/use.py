import tensorflow.compat.v1 as tf
import nltk
tf.disable_v2_behavior()
import tensorflow_hub as hub

'''
Versions of packages 
tensorflow==2.0.0
tensorflow-estimator==2.0.1
tensorflow-hub==0.7.0
'''


import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
import pandas as pd

'''
Versions of packages
numpy==1.17.2
seaborn==0.9.0
matplotlib==3.1.1
pandas==0.25.1
'''


# load universal sentence encoder module
def load_USE_encoder(module):
    with tf.Graph().as_default():
        sentences = tf.placeholder(tf.string)
        embed = hub.Module(module)
        embeddings = embed(sentences)
        session = tf.train.MonitoredSession()
    return lambda x: session.run(embeddings, {sentences: x})

# load the encoder module
encoder = load_USE_encoder('./USE')

# encoder = hub.Module("https://tfhub.dev/google/universal-sentence-encoder/1")

# define Sample User story
# As a user
# I want to add two numbers which is 1 and 2
# Such that i get the sum of 3.
messages = [
    "I want to add two numbers which is 1 and 2", 
    "input",
    "feed in",
    "put in",
    "load",
    "insert",
    "key in",
    "type in",
    "enter",
    "capture",
    "process",
    "store",
    "output",
    "result",
    "answer",
    "yield",
    "outcome",
    "conclusion",
    "end",
    "occur",
    "happen",
    "termination",
    "response"
]

# encode the messages
encoded_messages = encoder(messages)

# print(encoded_messages)

# show ouput
# cosine similarities
inputResult = 0
outputResult = 0
num_messages = len(messages)
similarities_df = pd.DataFrame()
for i in range(num_messages):
    for j in range(num_messages): 
        # cos(theta) = x * y / (mag_x * mag_y)
        dot_product = np.dot(encoded_messages[i], encoded_messages[j])
        mag_i = np.sqrt(np.dot(encoded_messages[i], encoded_messages[i]))
        mag_j = np.sqrt(np.dot(encoded_messages[j], encoded_messages[j]))

        cos_theta = dot_product / (mag_i * mag_j)

        similarities_df = similarities_df.append(
            {
                'similarity': cos_theta, 
                'message1': messages[i], 
                'message2': messages[j]
            },
            ignore_index=True
        )
        if i==0 and j>=1 and j <= 11:
            print("=========INPUT=========")
            print(str(cos_theta) + " : " + messages[i] + " :VS: " + messages[j])
            inputResult += cos_theta
        elif i ==0 and j>=12 and j <= num_messages:
            print("=========OUTPUT=========")
            print(str(cos_theta) + " : " + messages[i] + " :VS: " + messages[j])
            outputResult += cos_theta

print("Input Result: " + str(inputResult))
print("Output Result: " + str(outputResult))
# convert similarity matrix into dataframe
#similarity_heatmap = similarities_df.pivot("message1", "message2", "similarity")

# visualize the results
# ax = sns.heatmap(similarity_heatmap, cmap="YlGnBu")
# plt.show()

# check for verbs, prepositions, conjunctions from given string
nltk.download('punkt')
nltk.download('averaged_perceptron_tagger')
tokens = nltk.word_tokenize(messages[0])
tagged = nltk.pos_tag(tokens)
arrayTagged = np.array(tagged)
print(arrayTagged)
print(np.argwhere(arrayTagged =="CD"))
# NLTK tags https://www.ling.upenn.edu/courses/Fall_2003/ling001/penn_treebank_pos.html