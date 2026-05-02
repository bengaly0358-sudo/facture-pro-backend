require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// ============================
// MIDDLEWARE
// ============================
app.use(cors());
app.use(express.json());

// ============================
// ROUTE TEST
// ============================
// Route ping
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
        message: 'Facture Pro AI Backend 🤖'
    });
});

// ============================
// 🤖 ROUTE : GÉNÉRER DESCRIPTION
// ============================
app.post('/api/generer-description', async (req, res) => {
    try {
        const { article } = req.body;

        if (!article) {
            return res.status(400).json({
                error: 'Article requis'
            });
        }

        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
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
                    content: `Génère une description professionnelle 
                    pour cet article/service : "${article}"`
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
// 🤖 ROUTE : SUGGÉRER PRIX
// ============================
app.post('/api/suggerer-prix', async (req, res) => {
    try {
        const { article, devise } = req.body;

        if (!article) {
            return res.status(400).json({
                error: 'Article requis'
            });
        }

        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [
                {
                    role: "system",
                    content: `Tu es un expert en tarification de services et produits.
                    Tu suggères des prix réalistes en ${devise || '$'}.
                    Réponds UNIQUEMENT avec un nombre entier ou décimal.
                    Exemple de réponse valide : 150 ou 49.99
                    Pas de texte, pas de symbole, juste le nombre.`
                },
                {
                    role: "user",
                    content: `Quel prix suggères-tu pour : "${article}" en ${devise || '$'} ?`
                }
            ],
            temperature: 0.5,
            max_tokens: 20
        });

        const prixTexte = completion.choices[0].message.content.trim();
        const prix = parseFloat(prixTexte.replace(/[^0-9.]/g, ''));

        res.json({
            prix: isNaN(prix) ? 0 : prix
        });

    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================
// 🤖 ROUTE : ANALYSER FACTURE
// ============================
app.post('/api/analyser-facture', async (req, res) => {
    try {
        const { facture } = req.body;

        if (!facture) {
            return res.status(400).json({
                error: 'Facture requise'
            });
        }

        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [
                {
                    role: "system",
                    content: `Tu es un expert comptable et conseiller financier.
                    Tu analyses des factures et donnes des conseils.
                    Réponds TOUJOURS en français.
                    Sois concis et pratique.
                    Format de réponse :
                    ✅ Points positifs
                    ⚠️ Points à améliorer
                    💡 Conseils`
                },
                {
                    role: "user",
                    content: `Analyse cette facture et donne des conseils :
                    Client : ${facture.client}
                    Articles : ${JSON.stringify(facture.articles)}
                    Total : ${facture.total} ${facture.devise}
                    TVA : ${facture.tva}%
                    Réduction : ${facture.reduction}%`
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
// 🤖 ROUTE : CHATBOT SUPPORT
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
                Tu aides les utilisateurs à :
                - Créer des factures professionnelles
                - Comprendre la TVA et les réductions
                - Choisir le bon modèle de facture
                - Utiliser les fonctionnalités du site
                - Gérer leur abonnement
                Réponds TOUJOURS en français.
                Sois amical, professionnel et concis.
                Si tu ne sais pas, dis-le honnêtement.`
            }
        ];

        // Ajouter l'historique de conversation
        if (historique && Array.isArray(historique)) {
            historique.forEach(msg => {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }

        messages.push({
            role: "user",
            content: message
        });

        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
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
// 🤖 ROUTE : GÉNÉRER NOTES
// ============================
app.post('/api/generer-notes', async (req, res) => {
    try {
        const { client, total, devise } = req.body;

        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [
                {
                    role: "system",
                    content: `Tu génères des notes professionnelles
                    pour des factures. Inclus :
                    - Conditions de paiement
                    - Délai de paiement
                    - Remerciements
                    Maximum 3 phrases courtes.
                    Réponds en français.`
                },
                {
                    role: "user",
                    content: `Génère des notes pour une facture de
                    ${total} ${devise} pour le client ${client}`
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
// DÉMARRER SERVEUR
// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
});

// Garder le serveur éveillé
const https = require('https');
setInterval(() => {
    https.get(
        'https://facture-pro-backend.onrender.com/ping',
        (res) => {
            console.log('✅ Ping envoyé - Serveur actif');
        }
    ).on('error', (e) => {
        console.log('⚠️ Ping échoué:', e.message);
    });
}, 14 * 60 * 1000); // toutes les 14 minutes