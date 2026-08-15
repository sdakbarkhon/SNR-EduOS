/**
 * Экран dchpass «Изменить пароль».
 *
 * 15.08.2026 (заглушки). Здесь стояла форма-обманка: три поля пароля, шкала
 * надёжности и кнопка «Сохранить пароль», которая ничего не сохраняла —
 * просто закрывала экран (мок, как в удалённой форме привязки карты). Форма,
 * принимающая пароль и делающая вид, что сменила его, хуже её отсутствия:
 * родитель уверен, что код изменился, а войти сможет только по старому.
 *
 * Как есть на самом деле: код входа выдаёт школа (экран входа так и пишет —
 * «SMS пока не приходят, код можно узнать в школе»), приложение входит по
 * номеру телефона и этому коду. Менять код из приложения нельзя — школа
 * перестанет узнавать его при потере. Поэтому вместо формы экран объясняет,
 * что здесь будет, когда появится и что делать сейчас (общий SoonBody).
 *
 * Маршрут и строка «Изменить пароль» в настройках оставлены — раздел не
 * прячем, он просто честно рассказывает о себе.
 */
import { ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppBackground } from "../../theme";
import { InnerHeader } from "../../ui";
import { useAppLocale } from "../../i18n";
import { STUBS } from "../../navigation/routes";
import { SoonBody } from "../soon";

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const { d } = useAppLocale();
  const stub = STUBS.chpass;

  return (
    <AppBackground>
      <InnerHeader title={d.parentApp.scr.chPass} onBackPress={() => navigation.goBack()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 22,
          paddingTop: 14,
          paddingBottom: 118,
        }}
      >
        <SoonBody
          title={d.parentApp.scr.chPass}
          gradient={stub.g}
          iconPaths={[
            "M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z",
            "M8 11V7a4 4 0 1 1 8 0v4",
          ]}
          itemKey="chpass"
        />
      </ScrollView>
    </AppBackground>
  );
}
