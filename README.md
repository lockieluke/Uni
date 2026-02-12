# Uni Translate
<sub>A bi-directional speech translation app powered by a collection of large language models, submitted as part of my [Extended Project Qualification](https://www.ucas.com/connect/blogs/what-epq-and-why-should-i-do-one-epq-advice-1) (EPQ)</sub>

**Speak in your language and see in theirs in near real time.**

<img src="https://cdn.lockie.dev/uni-translate-epq-1.jpeg" alt="Uni Hero">

## Story
The human race has largely been divided by differences in customs, languages and culture.  I created Uni Translate so people can break through these barriers, communicate freely and share their ideas with each other without limitations.  I immigrated to Britain in 2021 from Hong Kong - a Cantonese speaking city, with my family including my grandparents who speak very limited English.  They had trouble communicating with other people especially in situations such as a doctor's appointment, they found it really difficult to explain to doctors how they're feeling and what they needed.  Google Translate served as a temporary but weak solution to the problem but it ultimately caused more problems than it solved due to the numerous translation errors and its inability to infer the context of the conversation.  Uni has been engineered to be a new way speakers of different languages communicate with each other using bi-directional translation, it consistently outperformed Google Translate during the stage of development especially languages I tested such as Cantonese, Romanian and Polish.  It was able to produce more natural and accurate results.

## Development

As this was developed to be an artefact as part of my EPQ submission, I did not want to overcomplicate things.  [Supabase](https://supabase.com/) handles user authentication and stores user data.  Because of a personal preference and past experience, I think it's *wrong* to have clients interact with a backend service like Supabase and Firebase directly, I created a middleware server/API endpoint hosted on [Cloudflare Workers](https://workers.cloudflare.com/) to validate and handle requests coming from clients.  Since this repository has a monorepo architecture, API types are written in TypeScript, separated into a separate package named `@uni/api` under [packages/api](./packages/api) and shared across the project across the client and the API.

Uni Translate uses modern technologies like [Biome](https://biomejs.dev/) for linting and [Bun](https://bun.com/) for package management, and its code quality is up to industry standards.  It's way easier to maintain than my past projects due to its simple structure.  The [React Native](https://reactnative.dev/) frontend uses [Nativewind](https://www.nativewind.dev/) for styling which makes it really easy to change up the design of the app, the choice of framework makes it tremendously more straightforward to port it to other platforms such as Android in the future if desired.  Uni Translate's API is able to automatically apply different language models depending on the language being translated and the context of the conversation.  The context engine is a simple but important component that ties everything together, it is able to compose and give language models the relevant information for more accurate translation.


### Context Engine
The context engine is also able to recognise terms that are not meant to be translated such as brand names, loan words and scientific terms like a disease's name in certain languages, this substantially improves accuracy.  The user can reset the context engine and start fresh anytime by pressing Clear Context in the menu just above the microphone button.  This improves understanding even in a professional setting such as when communicating with a professional worker like a doctor or nurse describing your symptoms.  For instance, when a Cantonese speaker is getting a vaccination at a surgery or clinic, the speaker could ask the doctor “我打完係唔係走得” in Cantonese which in plain sight means “Can I go after getting beat(/hit)?” but this clearly isn’t what the speaker implies, the word “打完” amongst the rest of phrase forming the question literally means “beat” in the past participle tense but in this context it’s supposed to imply the completion form of “jabbed/vaccinated” shortened.  With the help of the context engine, it’s able to recognise that the conversation takes place in a context where vaccination is involved, it is then able to make the decision to translate the word “打完” into “done vaccinated/getting/get the jab” instead of “getting/get beat/beat”. 

### Models

Uni Translate automatically switches between the following models for translation:
- Gemini 2.5 Flash
- GPT 5 Mini
- Qwen 3 235B A22B (2507) hosted on Cerebras for low-latency circumstances

And the following models for transcription(bidirectional speech to text):
- Whisper
- GPT 4o Transcribe'

These models can be hot swapped from the backend, or even switched automatically according to the language pair selected by the user

### Tech Stack

- [Expo](https://expo.dev/)
- [React Native](https://reactnative.dev/)
- [Bun](https://bun.com/)
- [Nativewind](https://www.nativewind.dev/)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Supabase](https://supabase.com/)
- [OpenAI API Platform](https://openai.com/api/)
- [OpenRouter](https://openrouter.ai/)
- [Biome](https://biomejs.dev/)

Code is all hand written without agentic coding due to the restrictions placed by the exam board

## Gallery

<img src="https://cdn.lockie.dev/uni-translate-epq-4.jpeg" alt="Uni Hero 2">
<img src="https://cdn.lockie.dev/uni-translate-epq-7.jpeg" alt="Uni transcribing">
<img src="https://cdn.lockie.dev/uni-translate-epq-6.jpeg" alt="Uni language selection">
<img src="https://cdn.lockie.dev/uni-translate-epq-9.jpeg" alt="Uni sign in screen">
