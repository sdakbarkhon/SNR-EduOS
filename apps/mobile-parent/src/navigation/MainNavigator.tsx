/**
 * Главный стек v2: маршрут Tabs (таб-навигатор с p5/p10/p17/d24/dhub) +
 * все остальные 59 маршрутов прототипа (см. screens-map.md) — итого 64
 * экрана. В Заходе 1 каждый маршрут рендерит StubScreen; реальные экраны
 * будут заменять заглушки по одному в Заходах 4–10 без изменения каркаса.
 *
 * Переходы — стандартный slide native-stack (соответствует анимациям
 * v2in/v2back макета: въезд/выезд по X).
 */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import StubScreen from "../screens/StubScreen";
import TabNavigator from "./TabNavigator";
import { STACK_ROUTES, type MainStackParamList } from "./routes";

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Tabs"
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      {STACK_ROUTES.map((name) => (
        <Stack.Screen key={name} name={name} component={StubScreen} />
      ))}
    </Stack.Navigator>
  );
}
