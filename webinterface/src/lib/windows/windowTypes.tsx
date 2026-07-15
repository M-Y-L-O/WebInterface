import Visualiser from "@/components/windows/visualiser";
import FileExplorer from "@/components/windows/FileExplorer";
import Settings from "@/components/windows/Other/Settings";
import Chat from "@/components/windows/Other/Chat";
import Properties from "@/components/windows/Other/Properties";
import DataInfo from "@/components/windows/DataWindows/DataInfo";
import DataViewer from "@/components/windows/DataWindows/DataViewer";
import Optimization from "@/components/windows/Optimization/Optimization";
import ModelEditor from "@/components/windows/ModelEditor";

export const enum Windows  {
    "Visualiser" = "Visualiser",
    "FileExplorer" = "FileExplorer",
    "ModelEditor" = "ModelEditor",
    "Settings" = "Settings",
    "Chat" = "Chat",
    "Properties" = "Properties",
    "Data Info" = "DataInfo",
    "Data Viewer" = "DataViewer",
    "Optimization" = "Optimization"
}

export type WindowType = keyof typeof Windows;

export const components = {
    Visualiser: Visualiser,
    FileExplorer: FileExplorer,
    ModelEditor: ModelEditor,
    Settings: Settings,
    Chat:Chat,
    Properties:Properties,
    DataInfo:DataInfo,
    DataViewer:DataViewer,
    Optimization:Optimization
}