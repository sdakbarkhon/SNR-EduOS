/**
 * AuthNavigator — стек экранов входа (Заход 4).
 *
 * Не использует native-stack: маршрутизация выбирается по phase из
 * AuthSessionContext (onboarding → phone → sms → childPicker). Такой
 * подход убирает необходимость дублировать переходы в двух местах
 * (setPhase + navigation.navigate); RootNavigator использует phase
 * === 'app' как единую точку переключения на MainNavigator, а тут
 * рендерим один текущий auth-экран поверх AppBackground.
 *
 * Все auth-экраны — presentational, вызывают setPhase(...) / verifyCode() /
 * enterApp() / pickDemoParent() из useAuthSession(), поэтому этому файлу
 * достаточно просто отрисовать нужный экран для текущей фазы.
 */
import OnboardingScreen from "../screens/auth/OnboardingScreen";
import LoginPhoneScreen from "../screens/auth/LoginPhoneScreen";
import LoginSmsScreen from "../screens/auth/LoginSmsScreen";
import LoginChildPickerScreen from "../screens/auth/LoginChildPickerScreen";
import { useAuthSession } from "../context/AuthSessionContext";
import { AppBackground } from "../theme";

export default function AuthNavigator() {
  const { phase } = useAuthSession();

  let Screen: React.ComponentType | null = null;
  if (phase === "onboarding") Screen = OnboardingScreen;
  else if (phase === "phone") Screen = LoginPhoneScreen;
  else if (phase === "sms") Screen = LoginSmsScreen;
  else if (phase === "childPicker") Screen = LoginChildPickerScreen;

  return <AppBackground>{Screen ? <Screen /> : null}</AppBackground>;
}
