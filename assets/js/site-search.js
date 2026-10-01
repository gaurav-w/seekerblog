/* Lightweight, client-side search over the generated public reading corpus. */
(() => {
  'use strict';

  const RESULT_LIMIT = 50;

  function normalise(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/sooktam/g, 'suktam')
      .replace(/sahasranamam/g, 'sahasranama')
      .replace(/sahasranam/g, 'sahasranama')
      .replace(/atharva\s+shirsha/g, 'atharvashirsha')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function excerpt(text, terms) {
    const source = String(text || '').replace(/\s+/g, ' ').trim();
    if (source.length <= 190) return source;
    const normalised = normalise(source);
    const matchIndex = terms.reduce((first, term) => {
      const index = normalised.indexOf(term);
      return index >= 0 && (first < 0 || index < first) ? index : first;
    }, -1);
    const start = Math.max(0, matchIndex - 55);
    const end = Math.min(source.length, start + 190);
    return `${start ? '…' : ''}${source.slice(start, end).trim()}${end < source.length ? '…' : ''}`;
  }

  function appendHighlight(target, text, rawQuery) {
    const source = String(text || '');
    const query = String(rawQuery || '').trim();
    const index = query ? source.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
    if (index < 0) {
      target.textContent = source;
      return;
    }
    target.append(document.createTextNode(source.slice(0, index)));
    const mark = document.createElement('mark');
    mark.textContent = source.slice(index, index + query.length);
    target.append(mark, document.createTextNode(source.slice(index + query.length)));
  }

  function searchableFields(record) {
    return [
      { label: 'English', value: record.english || '' },
      { label: 'Hindi', value: record.hindi || '' },
      { label: 'Text', value: record.source || '' },
    ].map(field => ({ ...field, normalised: normalise(field.value) }));
  }

  window.SeekerblogSiteSearch = {
    mount(options) {
      const input = options.input;
      const panel = options.panel;
      const container = options.container;
      const status = options.status;
      let corpus;
      let loading;
      let version = 0;
      let queryActive = false;

      function loadCorpus() {
        if (corpus) return Promise.resolve(corpus);
        if (!loading) {
          loading = fetch(options.indexUrl, { credentials: 'same-origin' })
            .then(response => {
              if (!response.ok) throw new Error(`Search index returned ${response.status}`);
              return response.json();
            })
            .then(records => {
              if (!Array.isArray(records)) throw new Error('Search index is not an array');
              corpus = records;
              return corpus;
            });
        }
        return loading;
      }

      function render(matches, terms, rawQuery) {
        container.replaceChildren();
        const fragment = document.createDocumentFragment();
        matches.slice(0, RESULT_LIMIT).forEach(match => {
          const result = document.createElement('a');
          result.className = 'site-search-result';
          result.href = match.record.url;

          const meta = document.createElement('span');
          meta.className = 'site-search-result-meta';
          meta.textContent = `${match.record.work} · ${match.record.location}`;

          const language = document.createElement('span');
          language.className = 'site-search-language';
          language.textContent = match.field.label;

          const body = document.createElement('span');
          body.className = 'site-search-excerpt';
          appendHighlight(body, excerpt(match.field.value, terms), rawQuery);

          result.append(meta, language, body);
          fragment.append(result);
        });
        container.append(fragment);
      }

      async function search(rawQuery) {
        const currentVersion = ++version;
        const query = normalise(rawQuery);
        const terms = query ? query.split(' ').filter(Boolean) : [];
        queryActive = terms.length > 0;
        if (!queryActive) {
          panel.hidden = true;
          container.replaceChildren();
          status.textContent = '';
          return;
        }

        panel.hidden = false;
        container.replaceChildren();
        status.textContent = 'Searching the library…';
        try {
          const records = await loadCorpus();
          if (currentVersion !== version) return;
          const matches = records.map(record => {
            const fields = searchableFields(record);
            const combined = fields.map(field => field.normalised).join(' ');
            if (!terms.every(term => combined.includes(term))) return null;
            const field = fields.find(candidate => terms.some(term => candidate.normalised.includes(term))) || fields[0];
            const phraseScore = field.normalised.includes(query) ? 2 : 0;
            const beginningScore = terms.some(term => field.normalised.startsWith(term)) ? 1 : 0;
            return { record, field, score: phraseScore + beginningScore };
          }).filter(Boolean).sort((left, right) => right.score - left.score || left.record.work.localeCompare(right.record.work));

          if (!matches.length) {
            status.textContent = 'No passages matched that search.';
            return;
          }
          status.textContent = matches.length > RESULT_LIMIT
            ? `${matches.length} passages found. Showing the first ${RESULT_LIMIT}; refine the search to narrow it.`
            : `${matches.length} ${matches.length === 1 ? 'passage' : 'passages'} found.`;
          render(matches, terms, rawQuery);
        } catch (error) {
          if (currentVersion !== version) return;
          status.textContent = 'The library search could not load. Please try again.';
        }
      }

      return {
        search,
        hasQuery: () => queryActive,
      };
    },
  };
})();
