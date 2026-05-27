import Link from "next/link";


const dictionaries: Record<
  string,
  {
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    featuresTitle: string;
    features: Array<{ title: string; desc: string; icon: string }>;
    langSelector: string;
  }
> = {
  en: {
    title: "Share Files Instantly, Securely",
    subtitle: "KavShare is the ultimate next-generation platform for high-speed file sharing and collaboration. Drag, drop, and share with anyone, anywhere.",
    ctaPrimary: "Get Started",
    ctaSecondary: "Learn More",
    featuresTitle: "Why Choose KavShare?",
    features: [
      {
        title: "Lightning Fast",
        desc: "Peer-to-peer acceleration ensures your files reach their destination at maximum speed.",
        icon: "⚡",
      },
      {
        title: "End-to-End Encryption",
        desc: "Your data is encrypted before it leaves your device, keeping it secure from prying eyes.",
        icon: "🔒",
      },
      {
        title: "No File Size Limits",
        desc: "Share large videos, high-res photos, or entire projects without worrying about size caps.",
        icon: "📦",
      },
    ],
    langSelector: "Change Language",
  },
  es: {
    title: "Comparte Archivos al Instante y de forma Segura",
    subtitle: "KavShare es la plataforma definitiva de próxima generación para compartir archivos y colaborar a alta velocidad. Arrastra, suelta y comparte con quien sea, donde sea.",
    ctaPrimary: "Empezar",
    ctaSecondary: "Saber Más",
    featuresTitle: "¿Por qué elegir KavShare?",
    features: [
      {
        title: "Velocidad Ultra Rápida",
        desc: "La aceleración punto a punto garantiza que tus archivos lleguen a su destino a la máxima velocidad.",
        icon: "⚡",
      },
      {
        title: "Cifrado de Extremo a Extremo",
        desc: "Tus datos se cifran antes de salir de tu dispositivo, manteniéndolos a salvo de miradas indiscretas.",
        icon: "🔒",
      },
      {
        title: "Sin Límites de Tamaño",
        desc: "Comparte videos grandes, fotos de alta resolución o proyectos enteros sin preocuparte por límites de tamaño.",
        icon: "📦",
      },
    ],
    langSelector: "Cambiar Idioma",
  },
  fr: {
    title: "Partagez des Fichiers Instantanément, en toute Sécurité",
    subtitle: "KavShare est la plateforme ultime de nouvelle génération pour le partage de fichiers et la collaboration à grande vitesse. Glissez, déposez et partagez avec n'importe qui, n'importe où.",
    ctaPrimary: "Commencer",
    ctaSecondary: "En savoir plus",
    featuresTitle: "Pourquoi Choisir KavShare ?",
    features: [
      {
        title: "Vitesse Éclair",
        desc: "L'accélération peer-to-peer garantit que vos fichiers atteignent leur destination à vitesse maximale.",
        icon: "⚡",
      },
      {
        title: "Chiffrement de bout en bout",
        desc: "Vos données sont chiffrées avant de quitter votre appareil, ce qui les protège des regards indiscrets.",
        icon: "🔒",
      },
      {
        title: "Aucune Limite de Taille",
        desc: "Partagez des vidéos volumineuses, des photos haute résolution ou des projets entiers sans vous soucier des limites.",
        icon: "📦",
      },
    ],
    langSelector: "Changer de Langue",
  },
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = dictionaries[locale] || dictionaries.en;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
              KavShare
            </span>
          </div>

          <div className="flex items-center space-x-6">
            {/* Language Selector */}
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-sm text-slate-300">
              <span className="font-medium">{dict.langSelector}:</span>
              <Link
                href="/en"
                className={`px-1.5 py-0.5 rounded transition ${
                  locale === "en"
                    ? "bg-purple-600 text-white font-bold"
                    : "hover:text-white"
                }`}
              >
                EN
              </Link>
              <Link
                href="/es"
                className={`px-1.5 py-0.5 rounded transition ${
                  locale === "es"
                    ? "bg-purple-600 text-white font-bold"
                    : "hover:text-white"
                }`}
              >
                ES
              </Link>
              <Link
                href="/fr"
                className={`px-1.5 py-0.5 rounded transition ${
                  locale === "fr"
                    ? "bg-purple-600 text-white font-bold"
                    : "hover:text-white"
                }`}
              >
                FR
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <main className="flex-1 flex flex-col justify-center items-center px-6 relative z-10 py-16">
        <div className="max-w-4xl text-center space-y-8">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent py-2">
            {dict.title}
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            {dict.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <Link
              href="#"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 transition-transform hover:-translate-y-0.5 active:translate-y-0 text-center"
            >
              {dict.ctaPrimary}
            </Link>
            <Link
              href="#"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold rounded-xl transition-all text-center"
            >
              {dict.ctaSecondary}
            </Link>
          </div>
        </div>

        {/* Features section */}
        <section className="max-w-5xl w-full mt-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            {dict.featuresTitle}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {dict.features.map((feature, idx) => (
              <div
                key={idx}
                className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl hover:border-slate-750 transition-all hover:bg-slate-900/80 hover:shadow-xl hover:shadow-purple-500/5 group"
              >
                <div className="text-3xl mb-4 bg-slate-800 w-12 h-12 flex items-center justify-center rounded-xl group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-purple-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-sm text-slate-500">
        <p>© 2026 KavShare. All rights reserved.</p>
      </footer>
    </div>
  );
}
