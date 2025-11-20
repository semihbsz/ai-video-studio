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

      <div className="z-10 max-w-3xl flex flex-col items-center">
        <div className="relative inline-block mb-6">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                AI Video Studio
            </span>
            </h1>
            <span className="absolute -bottom-2 -right-8 md:-right-12 rotate-[-8deg] bg-indigo-600 text-white text-[10px] md:text-xs font-bold px-2 py-0.5 rounded border border-indigo-400/30 shadow-lg shadow-indigo-500/20">
                BETA
            </span>
        </div>
        
        <p className="text-slate-400 text-lg md:text-xl mb-10 font-light max-w-2xl">
          Videolarınızı saniyeler içinde viral dikey içeriklere dönüştürün. 
          Otomatik altyazı, akıllı kadraj ve profesyonel stiller.
        </p>
        
        <button 
          onClick={onStart}
          className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-white/10 border border-white/20 rounded-full hover:bg-white hover:text-black hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mb-12"
        >
          <span>Stüdyoya Git</span>
          <i className="fa-solid fa-arrow-right ml-3 group-hover:translate-x-1 transition-transform"></i>
        </button>
      </div>

      {/* Footer / Social Links */}
      <div className="absolute bottom-8 z-20 flex flex-col items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600 font-semibold">Powered By</span>
        <div className="flex items-center gap-6 text-sm text-slate-400 font-medium">
             <a href="https://instagram.com/vidigitalmedia" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-indigo-400 transition-colors group">
                <i className="fa-brands fa-instagram text-lg group-hover:scale-110 transition-transform"></i>
                <span>@vidigitalmedia</span>
             </a>
             <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
             <a href="https://instagram.com/ssemihstagram" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-rose-400 transition-colors group">
                <i className="fa-brands fa-instagram text-lg group-hover:scale-110 transition-transform"></i>
                <span>@ssemihstagram</span>
             </a>
        </div>
      </div>

    </section>
  );
};

export default LandingHero;