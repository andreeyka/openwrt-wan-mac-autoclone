include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-wan-mac-autoclone
PKG_VERSION:=0.2.0
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Andrey <andrey@skzd.ru>

LUCI_TITLE:=LuCI Support for wan-mac-autoclone
LUCI_DESCRIPTION:=Web UI for the wan-mac-autoclone package: status, settings, re-clone / reset.
LUCI_DEPENDS:=+wan-mac-autoclone
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
