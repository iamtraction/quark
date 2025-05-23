import path from "node:path";
import { Details as UserAgentDetails } from "express-useragent";

const WINDOWS_EXTENSIONS = [
    ".exe",      // Squirrel.Windows
    ".nupkg",    // Squirrel.Windows
    ".msi",      // WiX MSI
    ".appx",     // AppX
];

const MAC_EXTENSIONS = [
    ".dmg",      // DMG
    ".pkg",      // PKG
];

const LINUX_EXTENSIONS = [
    ".AppImage", // AppImage
    ".deb",      // deb
    ".rpm",      // RPM
    ".flatpak",  // Flatpak
    ".snap",     // Snapcraft
];

export const getFilePlatform = (filename: string) => {
    const extension = path.extname(filename);
    const basename = path.basename(filename, extension).toLowerCase();

    if (LINUX_EXTENSIONS.includes(extension) || extension === ".zip" && basename.includes("linux")) {
        return "linux";
    }
    if (MAC_EXTENSIONS.includes(extension) || extension === ".zip" && basename.includes("darwin")) {
        return "darwin";
    }
    if (WINDOWS_EXTENSIONS.includes(extension) || extension === ".zip" && basename.includes("win32")) {
        return "win32";
    }

    return null;
};

export const getPreferredExtension = (platform: string | null, isUpdate?: boolean) => {
    switch (platform) {
    case "darwin":
        return isUpdate ? ".zip" : ".dmg";
    case "linux":
        return ".AppImage";
    case "win32":
        return ".exe";
    default:
        return ".zip";
    }
};

export const resolvePlatform = (platform: string) => {
    switch (platform) {
    case "mac":
    case "macos":
    case "osx":
        return "darwin";
    case "win":
    case "windows":
        return "win32";
    case "linux":
        return "linux";
    default:
        return null;
    }
};

export const resolvePlatformFromUserAgent = (ua?: UserAgentDetails) => {
    if (ua?.isMac) return "darwin";
    if (ua?.isLinux) return "linux";
    if (ua?.isWindows) return "win32";
    return null;
};
