require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const https = require('https');

const app = express();
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

app.use(cors());
app.use(express.json());

const MODEL = "llama-3.3-70b-versatile";

app.get('/ping', (req, res) => {
    res.json({
        status: 'alive',
        time: new Date().toISOString(),
        message: 'Serveur actif ✅'
    });
});

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Facture Pro AI Backend 🤖',
        model: MODEL
    });
});

app.post('/api/generer-description', async (req, res) => {
    try {
        const { article } = req.body;
        if (!article) {
            return res.status(400).json({ error: 'Article requis' });
        }
        const completion = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: "system",
                    content: `Tu es un assistant expert en facturation.
                    Génère une description professionnelle courte
                    maximum 2 phrases en français.`
                },
                {
                    role: "user",
                    content: `Description pour : "${article}"`
                }
            ],
            temperature: 0.7,
            max_tokens: 150
        });
        res.json({
            description: completion.choices[0].message.content
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/suggerer-prix', async (req, res) => {
    try {
        const { article, devise } = req.body;
        if (!article) {
            return res.status(400).json({ error: 'Article requis' });
        }
        const completion = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: "system",
                    content: `Expert en tarification.
                    Réponds UNIQUEMENT avec un nombre.
                    Exemple : 150 ou 49.99`
                },
                {
                    role: "user",
                    content: `Prix pour "${article}" en ${devise || '$'} ?`
                }
            ],
            temperature: 0.5,
            max_tokens: 20
        });
        const prixTexte =
            completion.choices[0].message.content.trim();
        const prix = parseFloat(
            prixTexte.replace(/[^0-9.]/g, '')
        );
        res.json({ prix: isNaN(prix) ? 0 : prix });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/analyser-facture', async (req, res) => {
    try {
        const completion = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: "system",
                    content: `Expert comptable.
                    Analyse les factures en français.
                    Format :
                    ✅ Points positifs
                    ⚠️ Points à améliorer
                    💡 Conseils`
                },
                {
                    role: "user",
                    content: `Analyse :
                    Client : ${req.body.client}
                    Articles : ${JSON.stringify(req.body.articles)}
                    Total : ${req.body.total}
                    TVA : ${req.body.tva}%
                    Réduction : ${req.body.reduction}%`
                }
            ],
            temperature: 0.7,
            max_tokens: 300
        });
        res.json({
            analyse: completion.choices[0].message.content
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generer-notes', async (req, res) => {
    try {
        const { client, total, devise } = req.body;
        const completion = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: "system",
                    content: `Génère des notes professionnelles
                    pour factures. Maximum 3 phrases en français.
                    Inclus conditions paiement et remerciements.`
                },
                {
                    role: "user",
                    content: `Notes pour facture de
                    ${total} ${devise} pour ${client}`
                }
            ],
            temperature: 0.7,
            max_tokens: 150
        });
        res.json({
            notes: completion.choices[0].message.content
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, historique } = req.body;
        if (!message) {
            return res.status(400).json({
                error: 'Message requis'
            });
        }
        const messages = [
            {
                role: "system",
                content: `Tu es l'assistant IA de Facture Pro.
                Tu aides à créer des factures professionnelles.
                Réponds TOUJOURS en français.
                Sois amical et professionnel.`
            }
        ];
        if (historique && Array.isArray(historique)) {
            historique.forEach(msg => {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }
        messages.push({ role: "user", content: message });
        const completion = await groq.chat.completions.create({
            model: MODEL,
            messages: messages,
            temperature: 0.8,
            max_tokens: 500
        });
        res.json({
            reponse: completion.choices[0].message.content
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
    console.log(`🤖 Modèle : ${MODEL}`);

    setInterval(() => {
        https.get(
            'https://facture-pro-backend.onrender.com/ping',
            (res) => {
                console.log('✅ Auto-ping OK');
            }
        ).on('error', (e) => {
            console.log('⚠️ Ping échoué');
        });
    }, 14 * 60 * 1000);
});