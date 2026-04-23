import React from "react";
import { Modal, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { useGlobalStyles } from "../globalStyles";

interface ModalSheetProps {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  animationType?: "none" | "slide" | "fade";
  dismissOnBackdrop?: boolean;
  cardStyle?: StyleProp<ViewStyle>;
  statusBarTranslucent?: boolean;
}

export function ModalSheet({
  visible,
  onRequestClose,
  children,
  animationType = "fade",
  dismissOnBackdrop = true,
  cardStyle,
  statusBarTranslucent,
}: ModalSheetProps) {
  const g = useGlobalStyles();
  return (
    <Modal
      visible={visible}
      animationType={animationType}
      transparent
      statusBarTranslucent={statusBarTranslucent}
      onRequestClose={onRequestClose}
    >
      <Pressable
        style={g.modalOverlay}
        onPress={dismissOnBackdrop ? onRequestClose : undefined}
      >
        <Pressable
          style={cardStyle ? [g.modal, cardStyle] : g.modal}
          onPress={(e) => e.stopPropagation()}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
