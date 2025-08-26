from flask import Flask
from threading import Thread

app = Flask('')

@app.route('/')
def home():
    return "TZbot is alive and running!"

@app.route('/status')
def status():
    return "Bot Status: Online"

def run():
    app.run(host='0.0.0.0', port=8080)

def keep_alive():
    t = Thread(target=run)
    t.daemon = True
    t.start()