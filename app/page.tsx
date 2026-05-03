export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-lg text-center">
        <h1 className="text-4xl font-bold text-indigo-900 mb-4">TabibVerify</h1>
        <p className="text-lg text-gray-600 mb-8">
          Service de vérification d&apos;identité pour les médecins algériens.
          Intégration simple via API pour les plateformes de santé.
        </p>
        <div className="bg-white rounded-xl shadow-lg p-6 text-left">
          <h2 className="font-semibold text-gray-800 mb-3">Pour les partenaires</h2>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
{`POST /api/v1/verification/start
Authorization: Bearer {API_KEY}

{
  "partner_doctor_id": "doc_123",
  "callback_url": "https://...",
  "redirect_url": "https://..."
}`}
          </pre>
          <p className="text-xs text-gray-400 mt-3">
            Contactez-nous pour obtenir une clé API partenaire.
          </p>
        </div>
      </div>
    </div>
  );
}
