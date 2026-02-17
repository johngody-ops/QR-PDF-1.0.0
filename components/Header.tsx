interface HeaderProps {
  isImporting: boolean;
  onFilesAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  hasFiles: boolean;
  onDownloadAll: () => void;
  canDownloadAll: boolean;
}

export const Header = ({ 
  isImporting, 
  onFilesAdd, 
  onClear, 
  hasFiles, 
  onDownloadAll, 
  canDownloadAll 
}) => (
  <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
    <div className="max-w-[1600px] mx-auto px-8 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-indigo-100 shadow-lg">
          <i className="fas fa-qrcode text-xl"></i>
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">QR-Doc Автоматизатор</h1>
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Умная группировка документов</p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        {hasFiles && (
          <>
            <button onClick={onClear} className="text-slate-400 hover:text-red-500 px-3 py-2 text-sm font-bold transition-all">
              Очистить всё
            </button>
            
            {canDownloadAll && (
              <button 
                onClick={onDownloadAll} 
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center active:scale-95 border border-slate-200"
              >
                <i className="fas fa-file-zipper mr-2 text-indigo-500"></i>
                Скачать все PDF
              </button>
            )}

            <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full font-bold text-sm cursor-pointer transition-all shadow-xl shadow-indigo-100 flex items-center active:scale-95">
              <i className={`fas ${isImporting ? 'fa-spinner fa-spin' : 'fa-plus-circle'} mr-2`}></i>
              {isImporting ? 'Загрузка...' : 'Добавить файлы'}
              <input type="file" multiple accept="image/*,application/pdf" onChange={onFilesAdd} className="hidden" disabled={isImporting} />
            </label>
          </>
        )}
      </div>
    </div>
  </header>
);
