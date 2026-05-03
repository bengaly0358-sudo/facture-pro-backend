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

// Modèle IA actuel
const MODEL = "llama3-70b-8192";

// ============================
// ROUTE PING
// ============================
app.get('/ping', (req, res) => {
    res.json({
        status: 'alive',
        time: new Date().toISOString(),
        message: 'Serveur actif ✅'
    });
});

// ============================
// ROUTE TEST
// ============================
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Facture Pro AI Backend 🤖',
        model: MODEL
    });
});

// ============================
// GÉNÉRER DESCRIPTION
// ============================
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
                    content: `Tu es un assistant expert en facturation professionnelle.
                    Tu génères des descriptions courtes et professionnelles
                    pour des articles ou services sur des factures.
                    Réponds TOUJOURS en français.
                    La description doit faire maximum 2 phrases.
                    Sois précis et professionnel.`
                },
                {
                    role: "user",
                    content: `Génère une description professionnelle pour : "${article}"`
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

// ============================
// SUGGÉRER PRIX
// ============================
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
                    content: `Tu es un expert en tarification.
                    Réponds UNIQUEMENT avec un nombre.
                    Pas de texte, pas de symbole, juste le nombre.
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

// ============================
// ANALYSER FACTURE
// ============================
app.post('/api/analyser-facture', async (req, res) => {
    try {
        const completion = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: "system",
                    content: `Tu es un expert comptable.
                    Tu analyses des factures et donnes des conseils.
                    Réponds en français. Sois concis.
                    Format :
                    ✅ Points positifs
                    ⚠️ Points à améliorer
                    💡 Conseils`
                },
                {
                    role: "user",
                    content: `Analyse cette facture :
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

// ============================
// GÉNÉRER NOTES
// ============================
app.post('/api/generer-notes', async (req, res) => {
    try {
        const { client, total, devise } = req.body;
        const completion = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: "system",
                    content: `Tu génères des notes professionnelles
                    pour des factures. Maximum 3 phrases.
                    Inclus conditions de paiement et remerciements.
                    Réponds en français.`
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

// ============================
// CHATBOT
// ============================
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
                Tu aides les utilisateurs à créer des factures
                professionnelles.
                Réponds TOUJOURS en français.
                Sois amical, professionnel et concis.`
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

// ============================
// DÉMARRER SERVEUR
// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
    console.log(`🤖 Modèle IA : ${MODEL}`);

    // Auto ping toutes les 14 minutes
    setInterval(() => {
        https.get(
            'https://facture-pro-backend.onrender.com/ping',
            (res) => {
                console.log('✅ Auto-ping OK');
            }
        ).on('error', (e) => {
            console.log('⚠️ Auto-ping échoué');
        });
    }, 14 * 60 * 1000);
});