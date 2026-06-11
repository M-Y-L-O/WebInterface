import Visualiser from "@/components/windows/visualiser";
import Settings from "@/components/windows/Settings";

export const enum Windows  {
    "Visualiser" = "Visualiser",
    "Settings" = "Settings",
}

export type WindowType = keyof typeof Windows;

export const components = {
    Visualiser: Visualiser,
    Settings: Settings,

}