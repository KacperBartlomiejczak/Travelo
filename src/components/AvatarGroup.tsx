import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Avatar, type AvatarSize } from "@/components/Avatar";
import { tokens } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type Person = {
  key: string;
  name: string;
  initial: string;
  colorIndex: number;
  photoUri?: string;
};

type Props = {
  people: Person[];
  size?: AvatarSize;
  /** Matches the surface the group sits on; defaults to the card surface. */
  borderColor?: string;
  testID?: string;
};

const { avatar } = tokens.components;

// design-context §8.7: the first 4 avatars overlap, the rest collapse into one `+N` circle. The group is a single
// accessibility element naming everyone, so the children are hidden from screen readers.
export function AvatarGroup({
  people,
  size = "xs",
  borderColor,
  testID,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  if (people.length === 0) return null;

  const visible = people.slice(0, avatar.groupMaxVisible);
  const extra = people.length - visible.length;
  const dimension = avatar[size];
  const ring = {
    borderWidth: avatar.borderWidth,
    borderColor: borderColor ?? theme.surface.primary,
    borderRadius: dimension / 2 + avatar.borderWidth,
  };

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={t("a11y.avatarGroup", {
        names: people.map((person) => person.name).join(", "),
      })}
      style={{ flexDirection: "row", alignItems: "center" }}
    >
      {visible.map((person, index) => (
        <View
          key={person.key}
          testID={`avatar-group-item-${index}`}
          aria-hidden
          style={[ring, index > 0 && { marginLeft: -avatar.groupOverlap }]}
        >
          <Avatar
            name={person.name}
            initial={person.initial}
            colorIndex={person.colorIndex}
            photoUri={person.photoUri}
            size={size}
          />
        </View>
      ))}
      {extra > 0 && (
        <View
          aria-hidden
          style={[
            ring,
            {
              marginLeft: -avatar.groupOverlap,
              width: dimension + 2 * avatar.borderWidth,
              height: dimension + 2 * avatar.borderWidth,
              backgroundColor: theme.background.sunken,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <Text
            style={[
              tokens.typography.styles.labelSM,
              { color: theme.text.secondary },
            ]}
          >{`+${extra}`}</Text>
        </View>
      )}
    </View>
  );
}
