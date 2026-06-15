import Visualiser from "@/components/windows/visualiser";
import Settings from "@/components/windows/Settings";
import Chat from "@/components/windows/Chat";
import Properties from "@/components/windows/Properties";

export const enum Windows  {
    "Visualiser" = "Visualiser",
    "Settings" = "Settings",
    "Chat" = "Chat",
    "Properties" = "Properties",
}

export type WindowType = keyof typeof Windows;

export const components = {
    Visualiser: Visualiser,
    Settings: Settings,
    Chat:Chat,
    Properties:Properties
}