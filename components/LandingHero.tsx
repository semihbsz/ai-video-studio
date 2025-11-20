import React from 'react';

interface LandingHeroProps {
  onStart: () => void;
}

const LandingHero: React.FC<LandingHeroProps> = ({ onStart }) => {
  return (
    <section className="h-screen w-full flex flex-col justify-center items-center text-center px-4 relative overflow-hidden">
      {/* Background Mesh Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-rose-500/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="z-10 max-w-3xl">
        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            AI Shorts Studio
          </span>
        </h1>
        <p className="text-slate-400 text-lg md:text-xl mb-10 font-light">
          Videolarınızı saniyeler içinde viral dikey içeriklere dönüştürün. 
          Otomatik altyazı, akıllı kadraj ve profesyonel stiller.
        </p>
        
        <button 
          onClick={onStart}
          className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-white/10 border border-white/20 rounded-full hover:bg-white hover:text-black hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <span>Stüdyoya Git</span>
          <i className="fa-solid fa-arrow-right ml-3 group-hover:translate-x-1 transition-transform"></i>
        </button>
      </div>
    </section>
  );
};

export default LandingHero;