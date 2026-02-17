
import React, { useState, useMemo } from 'react';
import { ScannedFile, AppStatus } from './types';
import { scanQrCode } from './services/qr.service';
import { extractPdfPages, createPdf } from './services/pdf.service';
import { Header } from './components/Header';
import { StatsSidebar } from './components/StatsSidebar';
import ScannerOverlay from './components/ScannerOverlay';

const App: React.FC = () => {
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [isImporting, setIsImporting] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const onFilesAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setIsImporting(true);
    const incoming = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
    const newItems: ScannedFile[] = [];

    for (const f of incoming) {
      if (f.type === 'application/pdf') {
        try {
          const pages = await extractPdfPages(f);
          pages.forEach((p, i) => newItems.push({ 
            id: crypto.randomUUID(), 
            file: f, 
            previewUrl: p, 
            qrData: null, 
            status: 'pending', 
            timestamp: Date.now() + i 
          }));
        } catch {
          // PDF extraction failed, skip this file silently
        }
      } else {
        newItems.push({ 
          id: crypto.randomUUID(), 
          file: f, 
          previewUrl: URL.createObjectURL(f), 
          qrData: null, 
          status: 'pending', 
          timestamp: Date.now() 
        });
      }
    }
    setFiles(prev => [...prev, ...newItems]);
    setStatus('ready');
    setIsImporting(false);
    setProcessedCount(0);
  };

  const handleScan = async () => {
    setStatus('scanning');
    setProcessedCount(0);
    
    const filesToScan = [...files];
    let completed = 0;

    for (const f of filesToScan) {
      if (f.status === 'success') {
        completed++;
        setProcessedCount(completed);
        continue;
      }

      setFiles(prev => prev.map(item => item.id === f.id ? { ...item, status: 'processing' } : item));
      const res = await scanQrCode(f.previewUrl);
      setFiles(prev => prev.map(item => item.id === f.id ? { ...item, qrData: res, status: res ? 'success' : 'failed' } : item));
      
      completed++;
      setProcessedCount(completed);
    }
    setStatus('ready');
  };

  const setManualId = (fileId: string) => {
    const manualId = prompt("QR-код не распознан. Введите ID документа вручную для принудительной группировки:");
    if (manualId && manualId.trim()) {
      setFiles(prev => prev.map(item => item.id === fileId ? { 
        ...item, 
        qrData: manualId.trim(), 
        status: 'success' 
      } : item));
    }
  };

  const reScanSingleFile = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    setFiles(prev => prev.map(item => item.id === fileId ? { ...item, status: 'processing' } : item));
    const res = await scanQrCode(file.previewUrl);
    setFiles(prev => prev.map(item => item.id === fileId ? { ...item, qrData: res, status: res ? 'success' : 'failed' } : item));
  };

  const groupsData = useMemo(() => {
    const grouped: Record<string, ScannedFile[]> = {};
    const unsorted: ScannedFile[] = [];
    
    files.forEach(f => {
      if (f.qrData) {
        if (!grouped[f.qrData]) grouped[f.qrData] = [];
        grouped[f.qrData].push(f);
      } else if (f.status !== 'pending') {
        unsorted.push(f);
      }
    });

    return { 
      grouped: Object.entries(grouped).sort((a,b) => a[0].localeCompare(b[0])),
      unsorted: unsorted.sort((a,b) => a.file.name.localeCompare(b.file.name, undefined, {numeric: true})),
      pending: files.filter(f => f.status === 'pending')
    };
  }, [files]);

  const handleDownloadAll = async () => {
    if (groupsData.grouped.length === 0) return;
    for (const [id, groupFiles] of groupsData.grouped) {
      await createPdf(groupFiles, id);
    }
  };

  const clearAll = () => {
    if (!confirm("Вы уверены, что хотите очистить все данные? Все текущие группы будут удалены.")) return;
    files.forEach(f => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
    setStatus('idle');
    setProcessedCount(0);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans selection:bg-indigo-100 text-slate-700">
      <Header 
        isImporting={isImporting} 
        onFilesAdd={onFilesAdd} 
        onClear={clearAll} 
        hasFiles={files.length > 0} 
        onDownloadAll={handleDownloadAll}
        canDownloadAll={groupsData.grouped.length > 0}
      />
      
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-8 py-10">
        {files.length === 0 ? (
          <div className="mt-16 flex flex-col items-center">
            <div className="bg-white border border-slate-200 rounded-[4rem] p-20 flex flex-col items-center justify-center shadow-xl shadow-slate-200/50 max-w-4xl w-full relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-30"></div>
              
              <label className="cursor-pointer mb-10 group/btn relative">
                <div className="bg-indigo-600 w-28 h-28 rounded-[2.5rem] flex items-center justify-center text-white text-5xl shadow-2xl shadow-indigo-200 transition-all group-hover/btn:scale-110 group-hover/btn:rotate-6 duration-500 relative z-10">
                  <i className="fas fa-file-circle-plus"></i>
                </div>
                <div className="absolute inset-0 bg-indigo-400 rounded-[2.5rem] blur-2xl opacity-0 group-hover/btn:opacity-40 transition-opacity"></div>
                <input type="file" multiple accept="image/*,application/pdf" onChange={onFilesAdd} className="hidden" disabled={isImporting} />
              </label>
              
              <h2 className="text-4xl font-black text-slate-800 mb-6 tracking-tight text-center">Начните работу здесь</h2>
              <p className="text-slate-500 text-center max-w-xl font-medium leading-relaxed mb-12 text-lg">
                Загрузите отсканированные страницы документов. Наше ПО найдет QR-коды и автоматически объединит страницы в многостраничные PDF-файлы.
              </p>

              <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[2rem] font-black text-lg cursor-pointer transition-all shadow-2xl shadow-indigo-200 flex items-center active:scale-95 mb-16 group/cta">
                <i className={`fas ${isImporting ? 'fa-spinner fa-spin' : 'fa-plus-circle'} mr-4 text-xl group-hover/cta:scale-110 transition-transform`}></i>
                {isImporting ? 'Загрузка документов...' : 'Добавить файлы для анализа'}
                <input type="file" multiple accept="image/*,application/pdf" onChange={onFilesAdd} className="hidden" disabled={isImporting} />
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-2xl">
                {[
                  { icon: 'fa-cloud-arrow-up', text: 'Загрузите файлы JPG, PNG или PDF', color: 'text-blue-500' },
                  { icon: 'fa-microchip', text: 'Запустите ИИ-анализ QR-кодов', color: 'text-indigo-500' },
                  { icon: 'fa-file-export', text: 'Скачайте готовые PDF документы', color: 'text-emerald-500' }
                ].map((step, idx) => (
                  <div key={idx} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col items-center text-center space-y-3">
                    <div className={`${step.color} text-xl bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm`}>
                      <i className={`fas ${step.icon}`}></i>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Шаг {idx+1}</span>
                    <p className="text-xs font-bold text-slate-600 leading-snug">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <aside className="lg:col-span-3">
              <StatsSidebar 
                total={files.length} 
                groups={groupsData.grouped.length} 
                unsorted={groupsData.unsorted.length} 
                status={status} 
                isImporting={isImporting} 
                onScan={handleScan}
                processedCount={processedCount}
                canScan={files.some(f => f.status === 'pending' || f.status === 'failed')}
              />
            </aside>

            <section className="lg:col-span-9 space-y-12 animate-in fade-in slide-in-from-right-10 duration-500">
              {groupsData.grouped.length > 0 && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between px-4">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-[0.25em] flex items-center">
                      <i className="fas fa-boxes-stacked mr-4 text-indigo-500"></i>
                      Сформированные пакеты ({groupsData.grouped.length})
                    </h3>
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-200">
                      Всего страниц в группах: {files.filter(f => f.qrData).length}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8">
                    {groupsData.grouped.map(([id, groupFiles]) => (
                      <div key={id} className="bg-white rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 flex flex-col h-full group/card overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex flex-col space-y-5 bg-gradient-to-br from-white to-slate-50/50">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-4 truncate">
                              <div className="bg-red-500 w-12 h-12 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-100 transition-transform group-hover/card:scale-110">
                                <i className="fas fa-file-pdf"></i>
                              </div>
                              <div className="truncate">
                                <h4 className="font-black text-slate-800 text-base truncate pr-2" title={id}>{id}</h4>
                                <div className="flex items-center mt-1 space-x-2">
                                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{groupFiles.length} стр.</span>
                                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                  <span className="text-[9px] text-emerald-500 font-black uppercase tracking-tighter bg-emerald-50 px-1.5 rounded">Успешно</span>
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={() => createPdf(groupFiles, id)}
                              className="bg-slate-900 text-white w-12 h-12 rounded-2xl hover:bg-indigo-600 transition-all shadow-xl active:scale-90 flex items-center justify-center"
                              title="Скачать PDF документ"
                            >
                              <i className="fas fa-download text-sm"></i>
                            </button>
                          </div>
                        </div>
                        <div className="p-8 flex-1 bg-white overflow-y-auto max-h-[280px] custom-scrollbar">
                          <div className="grid grid-cols-4 gap-4">
                            {groupFiles.map((f, idx) => (
                              <div key={f.id} className="relative group/thumb cursor-zoom-in" onClick={() => setSelectedImage(f.previewUrl)}>
                                <div className="aspect-[3/4] rounded-xl overflow-hidden border border-slate-100 shadow-sm transition-all group-hover/thumb:border-indigo-400 group-hover/thumb:ring-4 group-hover/thumb:ring-indigo-50">
                                  <img src={f.previewUrl} className="w-full h-full object-cover" alt={`Page ${idx + 1} of document ${id}`} />
                                  <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md backdrop-blur-md border border-white/20">
                                    #{idx+1}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center space-x-2 opacity-60">
                             <i className="fas fa-file-invoice text-[10px] text-slate-400"></i>
                             <span className="text-[9px] text-slate-500 font-mono truncate max-w-[140px]">{groupFiles[0].file.name}</span>
                          </div>
                          <button 
                            onClick={() => {
                              const newId = prompt("Изменить ID для этого документа:", id);
                              if (newId && newId !== id) {
                                setFiles(prev => prev.map(f => f.qrData === id ? {...f, qrData: newId} : f));
                              }
                            }}
                            className="text-[9px] font-black uppercase text-indigo-500 hover:text-indigo-700 transition-colors"
                          >
                            Изменить ID
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(groupsData.unsorted.length > 0 || groupsData.pending.length > 0) && (
                <div className="space-y-8 bg-white/50 p-8 rounded-[3rem] border border-slate-200/50">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="font-black text-slate-400 text-sm uppercase tracking-[0.25em] flex items-center">
                      <i className="fas fa-clipboard-question mr-4 text-orange-400"></i>
                      В ожидании решения ({groupsData.unsorted.length + groupsData.pending.length})
                    </h4>
                    {groupsData.unsorted.length > 0 && (
                      <div className="flex items-center space-x-2 bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100">
                        <i className="fas fa-triangle-exclamation text-orange-500 text-[10px]"></i>
                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">На {groupsData.unsorted.length} стр. код не найден</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                    {[...groupsData.pending, ...groupsData.unsorted].map(f => (
                      <div key={f.id} className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:border-indigo-400 hover:shadow-xl group/item relative flex flex-col">
                        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden mb-4 bg-slate-100 border border-slate-100 cursor-zoom-in group-hover/item:scale-[1.02] transition-transform duration-500" onClick={() => setSelectedImage(f.previewUrl)}>
                          <img src={f.previewUrl} className="w-full h-full object-cover opacity-80 group-hover/item:opacity-100 transition-opacity" alt={`Preview of ${f.file.name}`} />
                          <ScannerOverlay status={f.status} />
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-between space-y-3">
                          <p className="text-[9px] text-slate-400 truncate font-mono px-1" title={f.file.name}>{f.file.name}</p>
                          
                          {f.status === 'failed' && (
                             <div className="space-y-3 animate-in fade-in zoom-in duration-500">
                               <div className="flex items-center text-[8px] font-black text-red-500 uppercase bg-red-50 px-2.5 py-1.5 rounded-xl border border-red-100">
                                 <i className="fas fa-ban mr-2"></i> Ошибка чтения
                               </div>
                               <div className="grid grid-cols-2 gap-2">
                                 <button 
                                   onClick={() => setManualId(f.id)}
                                   className="py-2.5 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-90"
                                   title="Указать ID группы вручную"
                                 >
                                   <i className="fas fa-pen-nib"></i>
                                 </button>
                                 <button 
                                   onClick={() => reScanSingleFile(f.id)}
                                   className="py-2.5 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-xl hover:bg-slate-200 transition-all active:scale-90"
                                   title="Попробовать прочитать еще раз"
                                 >
                                   <i className="fas fa-rotate"></i>
                                 </button>
                               </div>
                             </div>
                          )}
                          
                          {f.status === 'pending' && (
                             <div className="flex items-center text-[9px] font-black text-slate-400 uppercase bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 border-dashed">
                               <i className="fas fa-hourglass-start mr-2 opacity-50"></i> Ожидание
                             </div>
                          )}
                          
                          {f.status === 'processing' && (
                             <div className="flex items-center text-[9px] font-black text-indigo-500 uppercase bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100">
                               <i className="fas fa-brain fa-spin mr-2"></i> Анализ...
                             </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* МОДАЛЬНОЕ ОКНО ПРОСМОТРА */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6 md:p-12 animate-in fade-in duration-300" onClick={() => setSelectedImage(null)}>
           <div className="absolute top-8 right-8 flex space-x-4">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const a = document.createElement('a');
                  a.href = selectedImage;
                  a.download = "preview.jpg";
                  a.click();
                }}
                className="bg-white/10 hover:bg-white/20 text-white w-14 h-14 rounded-2xl backdrop-blur-md flex items-center justify-center transition-all border border-white/10"
                title="Сохранить это изображение"
              >
                <i className="fas fa-download"></i>
              </button>
              <button className="bg-white/10 hover:bg-white/20 text-white w-14 h-14 rounded-2xl backdrop-blur-md flex items-center justify-center transition-all border border-white/10">
                <i className="fas fa-times text-xl"></i>
              </button>
           </div>
           
           <div className="relative group max-h-full max-w-full overflow-hidden rounded-3xl shadow-2xl shadow-black/50 border border-white/10" onClick={(e) => e.stopPropagation()}>
             <img src={selectedImage} className="max-h-[85vh] object-contain transition-transform duration-700 hover:scale-[1.02]" alt="Full-size page preview" />
             <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-full border border-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
               Детальный просмотр страницы
             </div>
           </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 py-12 px-10">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex flex-col md:flex-row items-center gap-10">
             <div className="flex items-center gap-3">
               <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-[pulse_3s_infinite]"></div>
               <span className="text-[11px] text-slate-500 font-black uppercase tracking-[0.2em]">Система готова к работе</span>
             </div>
             <div className="h-6 w-[1px] bg-slate-200 hidden md:block"></div>
             <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2 opacity-60">
                  <i className="fas fa-shield-halved text-indigo-500 text-xs"></i>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Client-Side Only</span>
                </div>
                <div className="flex items-center space-x-2 opacity-60">
                  <i className="fas fa-bolt text-yellow-500 text-xs"></i>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">High-Speed Scan</span>
                </div>
             </div>
          </div>
          <div className="flex flex-col items-center md:items-end space-y-2">
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
              &copy; {new Date().getFullYear()} QR-Doc Automator
            </p>
            <p className="text-[9px] text-slate-300 font-medium">v3.5 Build 2024.03 • Desktop Professional Edition</p>
          </div>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 12px; border: 2px solid #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  );
};

export default App;
