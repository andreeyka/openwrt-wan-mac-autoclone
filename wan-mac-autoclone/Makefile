include $(TOPDIR)/rules.mk

PKG_NAME:=wan-mac-autoclone
PKG_VERSION:=0.2.0
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Andrey <andrey@skzd.ru>

include $(INCLUDE_DIR)/package.mk

define Package/wan-mac-autoclone
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Auto-clone first LAN client's MAC onto the WAN interface
  DEPENDS:=+jshn
  PKGARCH:=all
endef

define Package/wan-mac-autoclone/description
 Automatically captures the MAC address of the first DHCP lease (or first ARP
 neighbour) seen on the LAN side and applies it as the macaddr override of the
 WAN interface. After the first capture the MAC is locked and never silently
 rotated, so the upstream ISP keeps seeing the same MAC across reboots.

 Use `wan-mac-autoclone reset` to release the lock when moving the router to
 a new uplink.
endef

define Package/wan-mac-autoclone/conffiles
/etc/config/wan-mac-autoclone
endef

define Build/Compile
endef

define Build/Configure
endef

define Package/wan-mac-autoclone/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/wan-mac-autoclone $(1)/etc/config/wan-mac-autoclone

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/wan-mac-autoclone $(1)/etc/init.d/wan-mac-autoclone

	$(INSTALL_DIR) $(1)/etc/hotplug.d/dhcp
	$(INSTALL_BIN) ./files/etc/hotplug.d/dhcp/30-wan-mac-autoclone $(1)/etc/hotplug.d/dhcp/30-wan-mac-autoclone

	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./files/usr/sbin/wan-mac-autoclone $(1)/usr/sbin/wan-mac-autoclone

	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./files/usr/libexec/rpcd/wan-mac-autoclone $(1)/usr/libexec/rpcd/wan-mac-autoclone
endef

define Package/wan-mac-autoclone/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
/etc/init.d/wan-mac-autoclone enable
/etc/init.d/wan-mac-autoclone start
/etc/init.d/rpcd reload 2>/dev/null
exit 0
endef

define Package/wan-mac-autoclone/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
/etc/init.d/wan-mac-autoclone stop 2>/dev/null
/etc/init.d/wan-mac-autoclone disable
exit 0
endef

$(eval $(call BuildPackage,wan-mac-autoclone))
