import br from 'thirdweb/dist/esm/react/web/wallets/shared/locale/br.js';
import de from 'thirdweb/dist/esm/react/web/wallets/shared/locale/de.js';
import en from 'thirdweb/dist/esm/react/web/wallets/shared/locale/en.js';
import es from 'thirdweb/dist/esm/react/web/wallets/shared/locale/es.js';
import fr from 'thirdweb/dist/esm/react/web/wallets/shared/locale/fr.js';
import ja from 'thirdweb/dist/esm/react/web/wallets/shared/locale/ja.js';
import kr from 'thirdweb/dist/esm/react/web/wallets/shared/locale/kr.js';
import ru from 'thirdweb/dist/esm/react/web/wallets/shared/locale/ru.js';
import tl from 'thirdweb/dist/esm/react/web/wallets/shared/locale/tl.js';
import vi from 'thirdweb/dist/esm/react/web/wallets/shared/locale/vi.js';
import zh from 'thirdweb/dist/esm/react/web/wallets/shared/locale/zh.js';

/**
 * Custom locale loader to avoid runtime chunk loading failures inside Telegram webviews.
 * We eagerly import the bundled locales instead of relying on Webpack dynamic chunks.
 */
export async function getInAppWalletLocale(localeId: string) {
  switch (localeId) {
    case 'es_ES':
      return es;
    case 'ja_JP':
      return ja;
    case 'tl_PH':
      return tl;
    case 'vi_VN':
      return vi;
    case 'de_DE':
      return de;
    case 'ko_KR':
      return kr;
    case 'fr_FR':
      return fr;
    case 'ru_RU':
      return ru;
    case 'pt_BR':
      return br;
    case 'zh_CN':
      return zh;
    default:
      return en;
  }
}
