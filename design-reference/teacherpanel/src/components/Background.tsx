export function Background() {
  return (
    <div 
      className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none"
      style={{
        background: 'radial-gradient(circle at 10% 20%, rgba(224, 242, 254, 1) 0%, rgba(240, 249, 255, 1) 50%, rgba(255, 255, 255, 1) 100%)',
        backgroundColor: '#f8fafc'
      }}
    >
      <div className="absolute top-[-100px] left-[-50px] w-80 h-80 bg-blue-200/40 rounded-full blur-[80px] animate-blob"></div>
      <div className="absolute bottom-[-50px] right-[10%] w-96 h-96 bg-cyan-200/30 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
      <div className="absolute top-[30%] right-[-50px] w-64 h-64 bg-indigo-100/50 rounded-full blur-[60px] animate-blob animation-delay-4000"></div>
    </div>
  );
}
