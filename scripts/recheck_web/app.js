/**
 * Human Recheck System Client Application (app.js)
 * Clean, modular, robust client controller with zero external runtime dependencies.
 */

(function () {
  'use strict';

  // --- State ---
  let queueWords = [];
  let currentIndex = 0;
  let currentLevelFilter = '';
  let activeTab = 'queue';
  let undoCount = 0;
  let kanjiHistory = [];
  let searchDebounceTimer = null;

  const LEVEL_COLORS = {
    N5: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    N4: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    N3: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    N2: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    N1: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  };

  // --- Audio Pronunciation (Japanese Speech Synthesis) ---
  window.speakJapanese = function (text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis failed:', e);
    }
  };

  // --- Helper: Escape HTML ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Initialize App ---
  async function init() {
    setupKeyboardShortcuts();
    setupSearchHandler();

    // 1. Check for SSR Pre-hydrated Data
    if (window.__INITIAL_DATA__) {
      applyInitialData(window.__INITIAL_DATA__);
    } else {
      await updateStats();
      await loadQueueWords();
    }
  }

  function applyInitialData(data) {
    if (data.stats) {
      renderStats(data.stats);
    }
    if (data.words && data.words.length > 0) {
      queueWords = data.words;
      currentIndex = 0;
      // If SSR already rendered the first card, keep it; otherwise render
      const container = document.getElementById('cardContainer');
      if (container && (!container.children || container.children.length === 0)) {
        renderCurrentCard();
      }
    } else {
      showEmptyQueueNotice();
    }
  }

  // --- Stats & Badges ---
  async function updateStats() {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) return;
      const data = await res.json();
      renderStats(data);
    } catch (err) {
      console.error('Failed to update stats:', err);
    }
  }

  function renderStats(stats) {
    const qBadge = document.getElementById('queueBadge');
    const aBadge = document.getElementById('approvedBadge');
    const rBadge = document.getElementById('rejectedBadge');
    const eBadge = document.getElementById('exportedBadge');
    const uBadge = document.getElementById('undoCountBadge');

    if (qBadge) qBadge.textContent = stats.translated ?? 0;
    if (aBadge) aBadge.textContent = stats.approved ?? 0;
    if (rBadge) rBadge.textContent = stats.rejected ?? 0;
    if (eBadge) eBadge.textContent = stats.exported ?? 0;
    if (uBadge) {
      undoCount = stats.history_count ?? 0;
      uBadge.textContent = undoCount;
    }

    const appCount = document.getElementById('approvedCountHeader');
    if (appCount) appCount.textContent = (stats.approved ?? 0) + ' คำ';

    const rejCount = document.getElementById('rejectedCountHeader');
    if (rejCount) rejCount.textContent = (stats.rejected ?? 0) + ' คำ';

    const expCount = document.getElementById('exportedCountHeader');
    if (expCount) expCount.textContent = (stats.exported ?? 0) + ' คำ';

    // Update level options count if provided
    if (stats.level_counts && document.getElementById('levelFilter')) {
      const select = document.getElementById('levelFilter');
      const curVal = select.value;
      const total = stats.translated ?? 0;
      select.innerHTML = `
        <option value="">ทั้งหมด (${total} คำ)</option>
        <option value="N5">N5 (${stats.level_counts.N5 ?? 0} คำ)</option>
        <option value="N4">N4 (${stats.level_counts.N4 ?? 0} คำ)</option>
        <option value="N3">N3 (${stats.level_counts.N3 ?? 0} คำ)</option>
        <option value="N1">N1 (${stats.level_counts.N1 ?? 0} คำ)</option>
      `;
      select.value = curVal;
    }
  }

  // --- Load Queue Words ---
  async function loadQueueWords() {
    try {
      const params = new URLSearchParams();
      params.set('status', 'translated');
      if (currentLevelFilter) params.set('level', currentLevelFilter);
      params.set('limit', '100');

      const res = await fetch('/api/words?' + params.toString());
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      queueWords = data.words || [];
      currentIndex = 0;

      if (queueWords.length > 0) {
        hideEmptyQueueNotice();
        await renderCurrentCard();
      } else {
        showEmptyQueueNotice();
      }
    } catch (err) {
      console.error('Failed to load queue words:', err);
    }
  }

  function showEmptyQueueNotice() {
    const card = document.getElementById('cardContainer');
    const notice = document.getElementById('emptyQueueNotice');
    if (card) card.innerHTML = '';
    if (notice) notice.classList.remove('hidden');
  }

  function hideEmptyQueueNotice() {
    const notice = document.getElementById('emptyQueueNotice');
    if (notice) notice.classList.add('hidden');
  }

  // --- Render Active Card ---
  async function renderCurrentCard() {
    const container = document.getElementById('cardContainer');
    if (!container) return;

    if (queueWords.length === 0 || currentIndex >= queueWords.length) {
      showEmptyQueueNotice();
      return;
    }

    hideEmptyQueueNotice();
    const baseWord = queueWords[currentIndex];

    // Fetch full word details (Kanji breakdown & similar words)
    let details = null;
    try {
      const res = await fetch('/api/word/' + baseWord.priority_rank);
      if (res.ok) {
        details = await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch word details:', e);
    }

    const word = (details && details.word) ? details.word : baseWord;
    const kanjiBreakdown = (details && details.kanji_breakdown) ? details.kanji_breakdown : [];
    const similarWords = (details && details.similar_words) ? details.similar_words : [];

    const lvlColor = LEVEL_COLORS[word.predicted_level] || 'bg-slate-800 text-slate-300 border-slate-700';

    // Interactive Japanese expression (clickable kanji characters)
    const kanjiRegex = /[\u4E00-\u9FAF]/;
    const exprHtml = Array.from(word.expression).map(ch => {
      if (kanjiRegex.test(ch)) {
        return `<span onclick="openKanjiModal('${ch}')" class="kanji-interactive hover:text-amber-400 hover:underline decoration-amber-400/60 px-0.5" title="คลิกดูคันจิ ${ch} ในคลังหลัก">${ch}</span>`;
      }
      return ch;
    }).join('');

    // Kanji breakdown cards
    let kanjiCardsHtml = '';
    if (kanjiBreakdown && kanjiBreakdown.length > 0) {
      const items = kanjiBreakdown.map(k => {
        const mTh = k.meaning_th || (Array.isArray(k.meanings_en) ? k.meanings_en.join(', ') : (k.meanings_en || ''));
        const onReadings = (k.readings_on || []).join('・');
        const kunReadings = (k.readings_kun || []).join('・');
        const readings = onReadings || kunReadings || '-';
        const jlpt = k.jlpt ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">${k.jlpt}</span>` : '';

        return `
          <div onclick="openKanjiModal('${k.kanji}')" class="bg-[#151B27] hover:bg-[#1C2434] border border-slate-800 hover:border-amber-500/50 p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all group shadow-sm">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-105 border border-amber-500/20 flex items-center justify-center font-japanese text-xl font-bold shrink-0 transition-transform">${k.kanji}</span>
              <div class="truncate">
                <div class="text-slate-200 group-hover:text-amber-300 font-semibold text-xs truncate transition-colors">${escapeHtml(mTh)}</div>
                <div class="text-[11px] text-slate-400 font-japanese truncate">${escapeHtml(readings)}</div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${jlpt}
              <span class="text-xs text-amber-400/60 group-hover:text-amber-400 transition-colors">🔍 ➔</span>
            </div>
          </div>
        `;
      }).join('');

      kanjiCardsHtml = `
        <div class="space-y-2 pt-1">
          <div class="text-xs font-semibold text-slate-400 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <span>🧩 คันจิประกอบคำ (${kanjiBreakdown.length} ตัว)</span>
              <span class="text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">คลิกที่คันจิเพื่อเปิดดูคลังหลัก</span>
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            ${items}
          </div>
        </div>
      `;
    }

    // Similar words in existing dictionary
    let similarWordsHtml = '';
    if (similarWords && similarWords.length > 0) {
      const simItems = similarWords.slice(0, 4).map(s => `
        <div class="bg-[#121622] border border-slate-800/80 p-2.5 rounded-xl text-xs flex items-center justify-between gap-2">
          <div class="min-w-0 truncate">
            <div class="flex items-center gap-1.5">
              <span class="font-japanese font-bold text-slate-200">${escapeHtml(s.expression)}</span>
              <span class="text-slate-400 text-[11px] font-japanese">(${escapeHtml(s.reading)})</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">${s.level}</span>
            </div>
            <div class="text-slate-400 text-[11px] truncate mt-0.5">${escapeHtml(s.meaning_th || s.meaning_en)}</div>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">${escapeHtml(s.match_reason)}</span>
        </div>
      `).join('');

      similarWordsHtml = `
        <div class="space-y-2 pt-2 border-t border-slate-800/60">
          <div class="text-xs font-semibold text-slate-400 flex items-center justify-between">
            <span>📚 คำในคลังหลักเดิมที่ใกล้เคียง / คล้ายกัน (n1-n5.csv)</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${simItems}
          </div>
        </div>
      `;
    }

    // Interactive Level Selector and Pills
    const pillBtnsHtml = ['N5', 'N4', 'N3', 'N2', 'N1'].map(lvl => {
      const isActive = word.predicted_level === lvl;
      let activeClass = '';
      if (isActive) {
        if (lvl === 'N5') activeClass = 'bg-emerald-500 text-white font-bold';
        else if (lvl === 'N4') activeClass = 'bg-sky-500 text-white font-bold';
        else if (lvl === 'N3') activeClass = 'bg-amber-500 text-white font-bold';
        else if (lvl === 'N2') activeClass = 'bg-indigo-500 text-white font-bold';
        else activeClass = 'bg-rose-500 text-white font-bold';
      } else {
        activeClass = 'bg-slate-800/80 text-slate-400 hover:text-white';
      }
      const numKey = lvl === 'N1' ? '1' : (lvl === 'N2' ? '2' : (lvl === 'N3' ? '3' : (lvl === 'N4' ? '4' : '5')));
      return `<button type="button" onclick="changeWordLevel('${lvl}')" class="px-2 py-0.5 text-[11px] rounded font-mono transition-colors ${activeClass}" title="ปรับเป็น ${lvl} (กด ${numKey})">${lvl}</button>`;
    }).join('');

    const levelControlHtml = `
      <div class="flex items-center gap-1.5 bg-[#161B27] px-2.5 py-1 rounded-xl border border-slate-700/80 shadow-sm">
        <label for="selectWordLevel" class="text-[11px] font-semibold text-slate-400">ระดับ:</label>
        <select 
          id="selectWordLevel" 
          onchange="changeWordLevel(this.value)"
          class="bg-[#1C2434] text-amber-300 font-mono font-bold text-xs px-2 py-0.5 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500 cursor-pointer"
          title="ปรับระดับ JLPT ของคำนี้ (คีย์ลัด: 1-5)"
        >
          <option value="N5" ${word.predicted_level === 'N5' ? 'selected' : ''}>N5</option>
          <option value="N4" ${word.predicted_level === 'N4' ? 'selected' : ''}>N4</option>
          <option value="N3" ${word.predicted_level === 'N3' ? 'selected' : ''}>N3</option>
          <option value="N2" ${word.predicted_level === 'N2' ? 'selected' : ''}>N2</option>
          <option value="N1" ${word.predicted_level === 'N1' ? 'selected' : ''}>N1</option>
        </select>
        <div class="flex items-center gap-1 pl-1 border-l border-slate-700">
          ${pillBtnsHtml}
        </div>
      </div>
    `;

    container.innerHTML = `
      <div class="bg-[#121622] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 card-transition relative overflow-hidden">
        
        <!-- Header Info Bar -->
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs pb-4 border-b border-slate-800/80">
          <div class="flex items-center gap-2">
            ${levelControlHtml}
            <span class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium border border-slate-700 text-xs">
              ${escapeHtml(word.category || 'GENERAL')}
            </span>
            <span class="text-indigo-400 font-mono font-semibold">#Rank ${word.priority_rank}</span>
            <span class="text-slate-500 text-[11px]">(${currentIndex + 1} จาก ${queueWords.length})</span>
          </div>
          
          <div class="flex items-center gap-1.5">
            <button 
              onclick="prevWord()" 
              class="px-3 py-1 bg-[#181E2B] hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1"
              title="ย้อนกลับไปดูคำก่อนหน้าในคิว"
            >
              <span>◀ ก่อนหน้า</span>
            </button>
            <button 
              onclick="skipWord()" 
              class="px-3 py-1 bg-[#181E2B] hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1"
              title="ข้ามไปคำถัดไป (คีย์ลัด: S หรือ ลูกศรลง)"
            >
              <span>ข้าม ⏭</span>
            </button>
          </div>
        </div>

        <!-- Expression & Pronunciation Hero -->
        <div class="text-center py-4 space-y-2">
          <!-- Furigana Reading -->
          <div class="text-slate-400 font-japanese text-base md:text-lg tracking-wider flex items-center justify-center gap-2">
            <span>${escapeHtml(word.reading)}</span>
            <button 
              onclick="speakJapanese('${word.reading}')" 
              class="p-1 rounded-full bg-slate-800/80 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 transition-colors text-sm"
              title="ฟังเสียงอ่านภาษาญี่ปุ่น"
            >
              🔊
            </button>
          </div>

          <!-- Main Japanese Expression -->
          <div class="text-4xl md:text-6xl font-extrabold text-white font-japanese tracking-wide py-1 drop-shadow-md">
            ${exprHtml}
          </div>

          <!-- ROMAJI: Prominent Yellow enclosed in [xxxx] -->
          <div class="text-amber-400 font-mono text-base md:text-lg font-bold tracking-wider pt-1">
            [${escapeHtml(word.romaji)}]
          </div>
        </div>

        <!-- 1. Editable Meanings Form (Placed right below Japanese Characters) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          
          <!-- Meaning Thai -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>🇹🇭 ความหมายภาษาไทย (แก้ไขได้)</span>
              <span class="text-[10px] text-slate-500 font-normal">บังคับมีตัวอักษรไทย</span>
            </label>
            <input 
              type="text" 
              id="inputMeaningTh" 
              value="${escapeHtml(word.meaning_th || '')}" 
              placeholder="กรอกคำแปลภาษาไทย..."
              class="w-full bg-[#181E2B] border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium"
            >
          </div>

          <!-- Meaning English -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>🇬🇧 ความหมายภาษาอังกฤษ (แก้ไขได้)</span>
              <span class="text-[10px] text-slate-500 font-normal">คำกริยาขึ้นต้นด้วย "to "</span>
            </label>
            <input 
              type="text" 
              id="inputMeaningEn" 
              value="${escapeHtml(word.meaning_en || '')}" 
              placeholder="English meaning..."
              class="w-full bg-[#181E2B] border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
            >
          </div>

        </div>

        <!-- 2. Primary Action Buttons (Reject, Skip, Approve) placed directly below Meanings -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          
          <!-- Reject Button -->
          <button 
            id="rejectCurrentWord" 
            onclick="reviewWord('rejected')" 
            class="py-3 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 text-rose-300 hover:text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 group shadow-sm hover:shadow-rose-600/20"
            title="ปฏิเสธคำนี้ (คีย์ลัด: ลูกศรซ้าย ⬅)"
          >
            <span class="text-base group-hover:-translate-x-1 transition-transform">⬅</span>
            <span>ปฏิเสธ (Reject)</span>
          </button>

          <!-- Skip Button -->
          <button 
            id="skipCurrentWord" 
            onclick="skipWord()" 
            class="py-3 px-4 rounded-2xl bg-[#181E2B] hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 group shadow-sm"
            title="ข้ามไปก่อน (คีย์ลัด: ลูกศรลง ⬇ หรือ S)"
          >
            <span class="text-base">⏭</span>
            <span>ข้ามไปก่อน (Skip)</span>
          </button>

          <!-- Approve Button -->
          <button 
            id="approveCurrentWord" 
            onclick="reviewWord('approved')" 
            class="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 group shadow-lg shadow-emerald-600/30"
            title="อนุมัติคำนี้ (คีย์ลัด: ลูกศรขวา ➔ หรือ Enter)"
          >
            <span>อนุมัติ (Approve)</span>
            <span class="text-base group-hover:translate-x-1 transition-transform">➔</span>
          </button>

        </div>

        <!-- 3. Review Comment & Quick-Click Template Chips -->
        <div class="space-y-2 pt-3 border-t border-slate-800/80">
          <div class="flex items-center justify-between text-xs">
            <label class="font-semibold text-slate-300 flex items-center gap-1.5">
              <span>📝 หมายเหตุการตรวจ / เหตุผลที่ปฏิเสธ (ถ้ามี)</span>
            </label>
            <button type="button" onclick="clearCommentInput()" class="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
              ล้างข้อความ
            </button>
          </div>
          <input 
            type="text" 
            id="inputComment" 
            placeholder="คลิกแท็กแม่แบบด้านล่าง หรือพิมพ์ระบุเหตุผล เช่น คำสแลง, ซ้ำซ้อน, แปลไม่ตรง..."
            class="w-full bg-[#161B27] border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none transition-all"
          >
          <!-- Common Template Chips -->
          <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span class="text-[10px] text-slate-500">แม่แบบพบบ่อย:</span>
            <button type="button" onclick="setCommentTemplate('คำสแลง / ภาษาพูด')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/60 transition-colors">💬 คำสแลง/ภาษาพูด</button>
            <button type="button" onclick="setCommentTemplate('ซ้ำซ้อนกับคลังหลัก')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-rose-300 border border-slate-700/60 transition-colors">⚠️ ซ้ำกับคลังหลัก</button>
            <button type="button" onclick="setCommentTemplate('แปลไทยไม่เป็นธรรมชาติ')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/60 transition-colors">✍️ แปลไม่ธรรมชาติ</button>
            <button type="button" onclick="setCommentTemplate('คำเฉพาะทาง / วิชาการ')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-indigo-300 border border-slate-700/60 transition-colors">🔬 เฉพาะทาง/วิชาการ</button>
            <button type="button" onclick="setCommentTemplate('คำโบราณ / พบน้อยมาก')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700/60 transition-colors">📜 โบราณ/พบน้อย</button>
            <button type="button" onclick="setCommentTemplate('ควรปรับระดับ JLPT')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-sky-300 border border-slate-700/60 transition-colors">🎯 ปรับระดับ JLPT</button>
            <button type="button" onclick="setCommentTemplate('คำนามเฉพาะ / ชื่อเฉพาะ')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700/60 transition-colors">🏷️ นามเฉพาะ</button>
            <button type="button" onclick="setCommentTemplate('รูปคันจิไม่นิยมใช้')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700/60 transition-colors">🈶 คันจิไม่นิยม</button>
          </div>
        </div>

        <!-- 4. Other Details: Kanji Breakdown -->
        ${kanjiCardsHtml}

        <!-- 5. Other Details: Similar Words in Existing App -->
        ${similarWordsHtml}

      </div>
    `;
  }

  // Helper for comment templates
  window.setCommentTemplate = function (text) {
    const input = document.getElementById('inputComment');
    if (!input) return;
    const current = input.value.trim();
    if (!current) {
      input.value = text;
    } else if (!current.includes(text)) {
      input.value = current + ', ' + text;
    }
    input.focus();
  };

  window.clearCommentInput = function () {
    const input = document.getElementById('inputComment');
    if (input) {
      input.value = '';
      input.focus();
    }
  };

  // --- Queue Actions ---
  window.changeWordLevel = async function (newLevel) {
    if (queueWords.length === 0 || currentIndex >= queueWords.length) return;
    const word = queueWords[currentIndex];
    newLevel = String(newLevel).toUpperCase().trim();
    if (!['N5', 'N4', 'N3', 'N2', 'N1'].includes(newLevel)) return;

    // Optimistically update in memory
    word.predicted_level = newLevel;

    const selectEl = document.getElementById('selectWordLevel');
    if (selectEl) selectEl.value = newLevel;

    try {
      await fetch('/api/update_level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority_rank: word.priority_rank, level: newLevel })
      });
      // Re-render current card to update pill colors
      await renderCurrentCard();
    } catch (err) {
      console.error('Failed to change level:', err);
    }
  };

  window.skipWord = function () {
    if (queueWords.length === 0) return;
    currentIndex = (currentIndex + 1) % queueWords.length;
    renderCurrentCard();
  };

  window.prevWord = function () {
    if (queueWords.length === 0) return;
    currentIndex = (currentIndex - 1 + queueWords.length) % queueWords.length;
    renderCurrentCard();
  };

  window.reviewWord = async function (decision) {
    if (queueWords.length === 0 || currentIndex >= queueWords.length) return;
    const word = queueWords[currentIndex];

    const inputTh = document.getElementById('inputMeaningTh');
    const inputEn = document.getElementById('inputMeaningEn');
    const inputCom = document.getElementById('inputComment');
    const selectLvl = document.getElementById('selectWordLevel');

    const meaningTh = inputTh ? inputTh.value.trim() : word.meaning_th;
    const meaningEn = inputEn ? inputEn.value.trim() : word.meaning_en;
    const comment = inputCom ? inputCom.value.trim() : '';
    const level = selectLvl ? selectLvl.value : word.predicted_level;

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority_rank: word.priority_rank,
          decision: decision,
          meaning_th: meaningTh,
          meaning_en: meaningEn,
          predicted_level: level,
          comment: comment
        })
      });

      const data = await res.json();
      if (data.success) {
        // Remove reviewed word from current in-memory queue
        queueWords.splice(currentIndex, 1);
        if (currentIndex >= queueWords.length) {
          currentIndex = 0;
        }

        // Update stats
        await updateStats();

        // Render next
        if (queueWords.length > 0) {
          await renderCurrentCard();
        } else {
          showEmptyQueueNotice();
        }
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error reviewing word:', err);
      alert('ไม่สามารถเชื่อมต่อกับ Server ได้');
    }
  };

  window.undoLastAction = async function () {
    try {
      const res = await fetch('/api/undo', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await updateStats();
        // Reload queue so the restored word reappears
        await loadQueueWords();
      } else {
        alert(data.message || 'ไม่มีรายการที่สามารถ Undo ได้');
      }
    } catch (err) {
      console.error('Undo failed:', err);
    }
  };

  // --- Kanji Inspector Modal ---
  window.openKanjiModal = async function (char) {
    if (!char) return;
    const backdrop = document.getElementById('kanjiModalBackdrop');
    const body = document.getElementById('kanjiModalBody');
    const backBtn = document.getElementById('modalHistoryBackBtn');
    if (!backdrop || !body) return;

    // Track navigation history inside modal
    if (kanjiHistory.length === 0 || kanjiHistory[kanjiHistory.length - 1] !== char) {
      kanjiHistory.push(char);
    }
    if (backBtn) {
      backBtn.classList.toggle('hidden', kanjiHistory.length <= 1);
    }

    backdrop.classList.remove('hidden');
    body.innerHTML = `
      <div class="py-12 text-center text-slate-400 space-y-3">
        <div class="animate-spin text-3xl">⏳</div>
        <div>กำลังโหลดข้อมูลคันจิ ${char} จากคลังหลัก...</div>
      </div>
    `;

    try {
      const res = await fetch('/api/kanji/' + encodeURIComponent(char));
      if (!res.ok) throw new Error('Failed to load kanji data');
      const data = await res.json();
      renderKanjiModalContent(data);
    } catch (err) {
      console.error('Error fetching kanji:', err);
      body.innerHTML = `
        <div class="py-8 text-center text-rose-400 space-y-2">
          <div>❌ ไม่สามารถโหลดข้อมูลคันจิ ${char} ได้</div>
          <div class="text-xs text-slate-500">${err.message}</div>
        </div>
      `;
    }
  };

  function renderKanjiModalContent(k) {
    const body = document.getElementById('kanjiModalBody');
    if (!body) return;

    // Onyomi list with yellow Romaji in [xxxx]
    const onList = (k.readings_on && k.readings_on.length > 0)
      ? k.readings_on.map(r => `
          <div class="bg-[#181E2B] border border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center justify-between gap-3 text-xs">
            <span class="font-japanese font-bold text-slate-100 text-sm">${escapeHtml(r.reading)}</span>
            <span class="text-amber-400 font-mono font-semibold">[${escapeHtml(r.romaji)}]</span>
          </div>
        `).join('')
      : '<div class="text-xs text-slate-500">ไม่มีเสียงอ่าน On-yomi ทั่วไป</div>';

    // Kunyomi list with yellow Romaji in [xxxx]
    const kunList = (k.readings_kun && k.readings_kun.length > 0)
      ? k.readings_kun.map(r => `
          <div class="bg-[#181E2B] border border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center justify-between gap-3 text-xs">
            <span class="font-japanese font-bold text-slate-100 text-sm">${escapeHtml(r.reading)}</span>
            <span class="text-amber-400 font-mono font-semibold">[${escapeHtml(r.romaji)}]</span>
          </div>
        `).join('')
      : '<div class="text-xs text-slate-500">ไม่มีเสียงอ่าน Kun-yomi ทั่วไป</div>';

    // Related words in existing N1-N5 database
    let relatedHtml = '';
    if (k.related_words && k.related_words.length > 0) {
      const rows = k.related_words.map(w => `
        <div class="bg-[#151B27] border border-slate-800/80 hover:border-slate-700 p-3 rounded-2xl flex items-center justify-between gap-3 transition-colors">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-japanese font-bold text-slate-100 text-sm">${escapeHtml(w.expression)}</span>
              <span class="text-slate-400 font-japanese text-xs">【${escapeHtml(w.reading)}】</span>
              <span class="text-amber-400 font-mono text-xs font-semibold">[${escapeHtml(w.romaji)}]</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">${w.level}</span>
            </div>
            <div class="text-xs text-slate-300 mt-1">${escapeHtml(w.meaning_th || w.meaning_en)}</div>
          </div>
          <button 
            onclick="speakJapanese('${w.reading}')" 
            class="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-xs shrink-0"
            title="ฟังเสียงอ่าน"
          >
            🔊
          </button>
        </div>
      `).join('');

      relatedHtml = `
        <div class="space-y-2 pt-2">
          <div class="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>📚 คำศัพท์ในคลังหลักเดิมที่ใช้คันจิตัวนี้ (ใน N1-N5)</span>
            <span class="text-[11px] text-amber-400 font-mono">${k.related_words_count} คำ</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            ${rows}
          </div>
        </div>
      `;
    } else {
      relatedHtml = `
        <div class="p-4 bg-[#151B27] rounded-2xl border border-slate-800 text-center text-xs text-slate-500">
          ไม่พบคำศัพท์อื่นในคลังหลัก (n1-n5.csv) ที่ใช้คันจิตัวนี้
        </div>
      `;
    }

    body.innerHTML = `
      <!-- Hero Top -->
      <div class="flex items-center gap-5 p-4 bg-[#151B27] rounded-2xl border border-slate-800/80">
        <div class="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-amber-400/5 border border-amber-500/30 flex items-center justify-center font-japanese text-5xl font-bold text-amber-400 shadow-lg shadow-amber-500/10 shrink-0">
          ${k.character}
        </div>
        <div class="space-y-1.5 flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold font-mono">${k.level}</span>
            <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">${k.strokes} ขีด</span>
            <button 
              onclick="speakJapanese('${k.character}')" 
              class="px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors flex items-center gap-1"
            >
              🔊 ฟังเสียง
            </button>
          </div>
          <div class="text-lg font-bold text-white truncate">${escapeHtml(k.meaning_th || '-')}</div>
          <div class="text-xs text-slate-400 truncate">${escapeHtml(k.meaning_en || '-')}</div>
        </div>
      </div>

      <!-- Readings: Onyomi & Kunyomi -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Onyomi -->
        <div class="space-y-2">
          <div class="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>เสียงอน (On-yomi — เสียงจีน มักใช้ในคำประสม)</span>
          </div>
          <div class="space-y-1.5">
            ${onList}
          </div>
        </div>

        <!-- Kunyomi -->
        <div class="space-y-2">
          <div class="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-sky-400"></span>
            <span>เสียงคุน (Kun-yomi — เสียงญี่ปุ่นแท้)</span>
          </div>
          <div class="space-y-1.5">
            ${kunList}
          </div>
        </div>

      </div>

      <!-- Related Words -->
      ${relatedHtml}
    `;
  }

  window.closeKanjiModal = function () {
    const backdrop = document.getElementById('kanjiModalBackdrop');
    if (backdrop) backdrop.classList.add('hidden');
    kanjiHistory = [];
  };

  window.modalGoBack = function () {
    if (kanjiHistory.length > 1) {
      kanjiHistory.pop(); // remove current
      const prevChar = kanjiHistory[kanjiHistory.length - 1];
      openKanjiModal(prevChar);
    }
  };

  // --- Search & Jump ---
  function setupSearchHandler() {
    const input = document.getElementById('wordSearchInput');
    const dropdown = document.getElementById('searchResultsDropdown');
    if (!input || !dropdown) return;

    input.addEventListener('input', function () {
      clearTimeout(searchDebounceTimer);
      const query = input.value.trim();
      if (!query) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        return;
      }

      searchDebounceTimer = setTimeout(async () => {
        try {
          const res = await fetch('/api/search?q=' + encodeURIComponent(query));
          if (!res.ok) return;
          const data = await res.json();
          renderSearchResults(data.results || []);
        } catch (e) {
          console.error('Search error:', e);
        }
      }, 250);
    });

    // Close search dropdown when clicking outside
    document.addEventListener('click', function (e) {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  function renderSearchResults(results) {
    const dropdown = document.getElementById('searchResultsDropdown');
    if (!dropdown) return;

    if (results.length === 0) {
      dropdown.innerHTML = '<div class="p-4 text-center text-slate-500">ไม่พบคำศัพท์ที่ตรงกับการค้นหา</div>';
      dropdown.classList.remove('hidden');
      return;
    }

    const items = results.map(r => `
      <div 
        onclick="jumpToWordRank(${r.priority_rank})" 
        class="p-3 hover:bg-[#1A2234] cursor-pointer transition-colors flex items-center justify-between gap-3 group"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-japanese font-bold text-white text-sm group-hover:text-amber-400 transition-colors">${escapeHtml(r.expression)}</span>
            <span class="text-slate-400 font-japanese text-xs">【${escapeHtml(r.reading)}】</span>
            <span class="text-amber-400 font-mono text-xs font-semibold">[${escapeHtml(r.romaji)}]</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">${r.predicted_level}</span>
            <span class="text-[10px] text-slate-500 font-mono">#${r.priority_rank}</span>
          </div>
          <div class="text-slate-300 text-xs mt-0.5 truncate">${escapeHtml(r.meaning_th || r.meaning_en)}</div>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
          ตรวจคำนี้ ➔
        </span>
      </div>
    `).join('');

    dropdown.innerHTML = items;
    dropdown.classList.remove('hidden');
  }

  window.jumpToWordRank = async function (rank) {
    const dropdown = document.getElementById('searchResultsDropdown');
    const input = document.getElementById('wordSearchInput');
    if (dropdown) dropdown.classList.add('hidden');
    if (input) input.value = '';

    // Switch to queue view if on another tab
    if (activeTab !== 'queue') {
      switchTab('queue');
    }

    try {
      const res = await fetch('/api/word/' + rank);
      if (!res.ok) throw new Error('Word not found');
      const data = await res.json();
      if (data.word) {
        // Prepend or jump to this word in queue
        const existingIdx = queueWords.findIndex(w => w.priority_rank === rank);
        if (existingIdx !== -1) {
          currentIndex = existingIdx;
        } else {
          queueWords.unshift(data.word);
          currentIndex = 0;
        }
        await renderCurrentCard();
      }
    } catch (err) {
      console.error('Jump failed:', err);
    }
  };

  // --- Filter Handler ---
  window.onFilterChange = async function () {
    const select = document.getElementById('levelFilter');
    if (select) {
      currentLevelFilter = select.value;
      await loadQueueWords();
    }
  };

  // --- Tabs Switching ---
  window.switchTab = async function (tab) {
    activeTab = tab;

    const tabs = ['queue', 'approved', 'rejected', 'exported'];
    tabs.forEach(t => {
      const btn = document.getElementById('tab' + capitalize(t) + 'Btn');
      const view = document.getElementById(t + 'View');
      if (btn) {
        if (t === tab) {
          btn.className = 'px-3 py-1.5 rounded-lg font-medium transition-all bg-indigo-600 text-white shadow-sm flex items-center gap-1.5';
        } else {
          btn.className = 'px-3 py-1.5 rounded-lg font-medium transition-all text-slate-400 hover:text-white hover:bg-slate-800/60 flex items-center gap-1.5';
        }
      }
      if (view) {
        view.classList.toggle('hidden', t !== tab);
      }
    });

    if (tab === 'approved') await loadApprovedList();
    if (tab === 'rejected') await loadRejectedList();
    if (tab === 'exported') await loadExportedList();
    if (tab === 'queue') {
      if (queueWords.length === 0) await loadQueueWords();
      else await renderCurrentCard();
    }
  };

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  window.updateApprovedWordLevel = async function (rank, newLevel) {
    try {
      const res = await fetch('/api/update_level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority_rank: rank, level: newLevel })
      });
      const data = await res.json();
      if (!data.success) {
        alert('ไม่สามารถเปลี่ยนระดับได้: ' + (data.error || ''));
      }
    } catch (err) {
      console.error('Failed to update level in approved list:', err);
    }
  };

  // --- Load Approved List ---
  async function loadApprovedList() {
    const tbody = document.getElementById('approvedTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500">กำลังโหลด...</td></tr>';

    try {
      const res = await fetch('/api/words?status=approved&limit=100');
      const data = await res.json();
      const words = data.words || [];

      if (words.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500">ยังไม่มีรายการที่ผ่านการอนุมัติ</td></tr>';
        return;
      }

      tbody.innerHTML = words.map(w => `
        <tr class="hover:bg-slate-800/40 transition-colors">
          <td class="p-3 font-mono text-slate-400">#${w.priority_rank}</td>
          <td class="p-3">
            <select 
              onchange="updateApprovedWordLevel(${w.priority_rank}, this.value)" 
              class="bg-[#1C2434] text-amber-300 font-mono font-bold text-xs px-2 py-0.5 rounded-lg border border-slate-700 cursor-pointer focus:outline-none focus:border-indigo-500"
              title="เปลี่ยนระดับ JLPT ของคำที่ผ่านแล้ว"
            >
              <option value="N5" ${w.predicted_level === 'N5' ? 'selected' : ''}>N5</option>
              <option value="N4" ${w.predicted_level === 'N4' ? 'selected' : ''}>N4</option>
              <option value="N3" ${w.predicted_level === 'N3' ? 'selected' : ''}>N3</option>
              <option value="N2" ${w.predicted_level === 'N2' ? 'selected' : ''}>N2</option>
              <option value="N1" ${w.predicted_level === 'N1' ? 'selected' : ''}>N1</option>
            </select>
          </td>
          <td class="p-3">
            <div class="font-japanese font-bold text-white">${escapeHtml(w.expression)}</div>
            <div class="text-[11px] text-slate-400 font-japanese">${escapeHtml(w.reading)} <span class="text-amber-400 font-mono">[${escapeHtml(w.romaji)}]</span></div>
          </td>
          <td class="p-3 text-slate-200 font-medium">${escapeHtml(w.meaning_th)}</td>
          <td class="p-3 text-slate-400">${escapeHtml(w.meaning_en)}</td>
          <td class="p-3 text-center">
            <button onclick="revertToQueue(${w.priority_rank})" class="text-[11px] text-indigo-400 hover:text-indigo-300 underline">
              ย้ายกลับคิว
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-rose-400">เกิดข้อผิดพลาดในการโหลด</td></tr>';
    }
  }

  // --- Load Rejected List ---
  async function loadRejectedList() {
    const tbody = document.getElementById('rejectedTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-500">กำลังโหลด...</td></tr>';

    try {
      const res = await fetch('/api/words?status=rejected&limit=100');
      const data = await res.json();
      const words = data.words || [];

      if (words.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-500">ไม่มีรายการที่ถูกปฏิเสธ</td></tr>';
        return;
      }

      tbody.innerHTML = words.map(w => `
        <tr class="hover:bg-slate-800/40 transition-colors">
          <td class="p-3 font-mono text-slate-400">#${w.priority_rank}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${LEVEL_COLORS[w.predicted_level] || 'bg-slate-800 text-slate-300'}">${w.predicted_level}</span>
          </td>
          <td class="p-3">
            <div class="font-japanese font-bold text-white">${escapeHtml(w.expression)}</div>
            <div class="text-[11px] text-slate-400 font-japanese">${escapeHtml(w.reading)} <span class="text-amber-400 font-mono">[${escapeHtml(w.romaji)}]</span></div>
          </td>
          <td class="p-3 text-slate-400">${escapeHtml(w.review_comment || 'ไม่ระบุเหตุผล')}</td>
          <td class="p-3 text-center">
            <button onclick="revertToQueue(${w.priority_rank})" class="text-[11px] text-emerald-400 hover:text-emerald-300 underline">
              นำกลับมาตรวจใหม่
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-rose-400">เกิดข้อผิดพลาดในการโหลด</td></tr>';
    }
  }

  // --- Load Exported List ---
  async function loadExportedList() {
    const tbody = document.getElementById('exportedTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-500">กำลังโหลด...</td></tr>';

    try {
      const res = await fetch('/api/words?status=exported&limit=100');
      const data = await res.json();
      const words = data.words || [];

      if (words.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-500">ยังไม่มีรายการที่ส่งออก</td></tr>';
        return;
      }

      tbody.innerHTML = words.map(w => `
        <tr class="hover:bg-slate-800/40 transition-colors">
          <td class="p-3 font-mono text-slate-400">#${w.priority_rank}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${LEVEL_COLORS[w.predicted_level] || 'bg-slate-800 text-slate-300'}">${w.predicted_level}</span>
          </td>
          <td class="p-3">
            <div class="font-japanese font-bold text-white">${escapeHtml(w.expression)}</div>
            <div class="text-[11px] text-slate-400 font-japanese">${escapeHtml(w.reading)} <span class="text-amber-400 font-mono">[${escapeHtml(w.romaji)}]</span></div>
          </td>
          <td class="p-3 text-slate-200">${escapeHtml(w.meaning_th)}</td>
          <td class="p-3 text-slate-400 text-[11px]">${escapeHtml(w.exported_at || '-')}</td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-rose-400">เกิดข้อผิดพลาดในการโหลด</td></tr>';
    }
  }

  window.revertToQueue = async function (rank) {
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority_rank: rank, decision: 'translated' })
      });
      const data = await res.json();
      if (data.success) {
        await updateStats();
        if (activeTab === 'approved') await loadApprovedList();
        if (activeTab === 'rejected') await loadRejectedList();
      }
    } catch (err) {
      console.error('Revert failed:', err);
    }
  };

  // --- Export & Rollback ---
  window.exportApprovedToApp = async function () {
    const confirmed = confirm('ยืนยันการส่งออกคำศัพท์ที่ผ่านการตรวจทั้งหมดเข้าคลังหลัก (n1-n5.csv)?\n(ระบบจะทำการสำรองข้อมูลเดิมอัตโนมัติก่อนส่งออก)');
    if (!confirmed) return;

    try {
      const res = await fetch('/api/export', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('ส่งออกสำเร็จ! บรรจุคำศัพท์เข้าคลังหลักเรียบร้อยแล้ว: ' + data.exported_count + ' คำ\n(สำรองข้อมูลไว้ที่: ' + data.backup_dir + ')');
        await updateStats();
        await loadApprovedList();
      } else {
        alert('ไม่สามารถส่งออกได้: ' + (data.error || 'ตรวจสอบเงื่อนไขไม่ผ่าน'));
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('เกิดข้อผิดพลาดในการส่งออก');
    }
  };

  window.rollbackLatestExport = async function () {
    const confirmed = confirm('ยืนยันการ Rollback (ย้อนกลับ) การส่งออกล่าสุด?\n(ระบบจะคืนค่าไฟล์ n*.csv จาก Backup และย้ายคำกลับมาเป็นสถานะ Approved)');
    if (!confirmed) return;

    try {
      const res = await fetch('/api/rollback', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Rollback สำเร็จ! คืนค่าคำศัพท์ ' + data.restored_count + ' คำ เรียบร้อยแล้ว');
        await updateStats();
        await loadExportedList();
      } else {
        alert('Rollback ไม่สำเร็จ: ' + (data.error || 'ไม่มีประวัติที่ย้อนกลับได้'));
      }
    } catch (err) {
      console.error('Rollback error:', err);
      alert('เกิดข้อผิดพลาดในการ Rollback');
    }
  };

  // --- Keyboard Shortcuts ---
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', function (e) {
      // If modal is open, Escape closes it
      const modal = document.getElementById('kanjiModalBackdrop');
      if (modal && !modal.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          closeKanjiModal();
          e.preventDefault();
        }
        return;
      }

      // If typing in any input field or textarea, do not trigger single-key hotkeys
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if (isInput) {
        if (e.key === 'Escape') {
          activeEl.blur();
          e.preventDefault();
        } else if (e.key === 'Enter' && activeEl.id === 'inputMeaningTh') {
          // Enter in Thai meaning inputs approve word
          reviewWord('approved');
          e.preventDefault();
        }
        return;
      }

      // Shortcut: / to focus search
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('wordSearchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Hotkeys only active in queue view
      if (activeTab !== 'queue') return;

      // Number keys 1-5 to adjust JLPT level (1=N1, 2=N2, 3=N3, 4=N4, 5=N5)
      if (e.key === '1') {
        e.preventDefault();
        changeWordLevel('N1');
        return;
      } else if (e.key === '2') {
        e.preventDefault();
        changeWordLevel('N2');
        return;
      } else if (e.key === '3') {
        e.preventDefault();
        changeWordLevel('N3');
        return;
      } else if (e.key === '4') {
        e.preventDefault();
        changeWordLevel('N4');
        return;
      } else if (e.key === '5') {
        e.preventDefault();
        changeWordLevel('N5');
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        reviewWord('approved');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        reviewWord('rejected');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        skipWord();
      } else if (e.key === 'ArrowUp' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        undoLastAction();
      }
    });
  }

  // --- Run on DOM Ready ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
