import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import i18n from "@/i18n";

import { Avatar } from "@/components/Avatar";
import { AvatarGroup } from "@/components/AvatarGroup";
import { darkTheme, lightTheme } from "@/theme/theme";
import { tokens } from "@/theme/tokens";
import { DarkThemeScope } from "@/theme/useTheme";

const { avatar } = tokens.components;
const person = (n: number) => ({
  key: `p${n}`,
  name: `Person ${n}`,
  initial: String.fromCharCode(64 + n),
  colorIndex: n,
});

beforeEach(async () => {
  await i18n.changeLanguage("pl");
});

describe("Avatar", () => {
  it("shows one letter on the palette colour of its index, sized by the token", async () => {
    await render(<Avatar name="Ola" initial="O" colorIndex={1} testID="a" />);
    const style = StyleSheet.flatten(screen.getByTestId("a").props.style);
    expect(screen.getByText("O")).toBeTruthy();
    expect(style).toMatchObject({
      width: avatar.xs,
      height: avatar.xs,
      borderRadius: avatar.xs / 2,
      backgroundColor: lightTheme.avatarFallback[1]!.background,
    });
    expect(StyleSheet.flatten(screen.getByText("O").props.style).color).toBe(
      lightTheme.avatarFallback[1]!.foreground,
    );
  });

  it("wraps the colour index around the palette", async () => {
    const count = lightTheme.avatarFallback.length;
    await render(
      <Avatar name="Ola" initial="O" colorIndex={count + 2} testID="a" />,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId("a").props.style).backgroundColor,
    ).toBe(lightTheme.avatarFallback[2]!.background);
  });

  it("uses the dark palette in dark mode", async () => {
    await render(
      <DarkThemeScope>
        <Avatar name="Ola" initial="O" colorIndex={0} testID="a" />
      </DarkThemeScope>,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId("a").props.style).backgroundColor,
    ).toBe(darkTheme.avatarFallback[0]!.background);
  });

  it("applies the requested size", async () => {
    await render(
      <Avatar name="Ola" initial="O" colorIndex={0} size="lg" testID="a" />,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId("a").props.style),
    ).toMatchObject({ width: avatar.lg, height: avatar.lg });
  });

  it("is labelled with the name as an image", async () => {
    await render(<Avatar name="Ola" initial="O" colorIndex={0} />);
    expect(screen.getByRole("image", { name: "Ola" })).toBeTruthy();
  });

  it("shows the photo instead of the letter, and the letter again when it fails to load", async () => {
    await render(
      <Avatar
        name="Ola"
        initial="O"
        colorIndex={0}
        photoUri="file:///me.jpg"
      />,
    );
    expect(screen.queryByText("O")).toBeNull();
    const photo = screen.getByTestId("avatar-photo");
    expect(photo.props.source).toEqual([{ uri: "file:///me.jpg" }]);
    await fireEvent(photo, "error", { nativeEvent: { error: "boom" } });
    expect(screen.queryByTestId("avatar-photo")).toBeNull();
    expect(screen.getByText("O")).toBeTruthy();
  });
});

describe("AvatarGroup", () => {
  it("renders nothing for an empty list", async () => {
    await render(<AvatarGroup people={[]} testID="g" />);
    expect(screen.queryByTestId("g")).toBeNull();
  });

  it("shows up to 4 avatars and no +N", async () => {
    await render(<AvatarGroup people={[1, 2, 3, 4].map(person)} />);
    for (const letter of ["A", "B", "C", "D"])
      expect(
        screen.getByText(letter, { includeHiddenElements: true }),
      ).toBeTruthy();
    expect(
      screen.queryByText(/^\+/, { includeHiddenElements: true }),
    ).toBeNull();
  });

  it("shows the first 4 and a +N circle for the rest", async () => {
    await render(<AvatarGroup people={[1, 2, 3, 4, 5, 6, 7].map(person)} />);
    expect(screen.getByText("D", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText("E", { includeHiddenElements: true })).toBeNull();
    expect(
      screen.getByText("+3", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it("is one element listing every name", async () => {
    await render(
      <AvatarGroup people={[1, 2, 3, 4, 5].map(person)} testID="g" />,
    );
    expect(screen.getByTestId("g").props.accessibilityLabel).toBe(
      "Uczestnicy: Person 1, Person 2, Person 3, Person 4, Person 5",
    );
    expect(screen.queryByRole("image")).toBeNull();
  });

  it("overlaps the avatars and draws the border in the given colour", async () => {
    await render(
      <AvatarGroup people={[1, 2].map(person)} borderColor="#123456" />,
    );
    const second = StyleSheet.flatten(
      screen.getByTestId("avatar-group-item-1", { includeHiddenElements: true })
        .props.style,
    );
    expect(second).toMatchObject({
      marginLeft: -avatar.groupOverlap,
      borderWidth: avatar.borderWidth,
      borderColor: "#123456",
    });
  });
});
