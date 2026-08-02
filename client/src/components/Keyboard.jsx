const ROWS_PT = ['q w e r t y u i o p', 'a s d f g h j k l ç', '{enter} z x c v b n m {back}'];
const ROWS_EN = ['q w e r t y u i o p', 'a s d f g h j k l', '{enter} z x c v b n m {back}'];

export default function Keyboard({ language, letterStatus, onKey }) {
  const rows = (language === 'pt' ? ROWS_PT : ROWS_EN).map((r) => r.split(' '));

  return (
    <div className="keyboard">
      {rows.map((row, i) => (
        <div key={i} className="keyboard-row">
          {row.map((key) => {
            if (key === '{enter}') {
              return (
                <button key={key} className="key key-wide" onClick={() => onKey('ENTER')}>
                  Enviar
                </button>
              );
            }
            if (key === '{back}') {
              return (
                <button key={key} className="key key-wide" onClick={() => onKey('BACKSPACE')}>
                  ⌫
                </button>
              );
            }
            const status = letterStatus[key];
            return (
              <button
                key={key}
                className={`key ${status ?? ''}`}
                onClick={() => onKey(key)}
              >
                {key.toUpperCase()}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
