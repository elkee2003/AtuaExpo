import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 30,
    marginHorizontal: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    margin: 10,
  },
  bckBtnCon: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  bckBtnIcon: {
    fontSize: 30,
    color: "black",
  },
  signoutBtn: {
    position: "absolute",
    top: 10,
    right: 15,
  },
  signoutTxt: {
    fontSize: 16,
    color: "#c90707",
  },
  profilePicWrapper: {
    alignItems: "center",
    marginVertical: 15,
  },

  profilePicContainer: {
    height: 150,
    width: 150,
    borderRadius: 75,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  img: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
    borderRadius: 75,
  },

  placeholderContainer: {
    justifyContent: "center",
    alignItems: "center",
  },

  addPhotoText: {
    marginTop: 5,
    fontSize: 14,
    color: "#555",
  },

  cameraIconContainer: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "#07a830",
    height: 35,
    width: 35,
    borderRadius: 17.5,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },

  /* ========== REMOVE (X) BUTTON ========== */
  removeButtonContainer: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#000",
    height: 28,
    width: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  input: {
    marginVertical: 10,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 5,
  },
  error: {
    color: "#d80b0b",
    fontSize: 13,
    marginTop: 5,
    marginHorizontal: 15,
    marginBottom: 5,
  },
  // saveBackground:{
  //     alignItems:'center',
  //     backgroundColor:'#18b403',
  //     padding: 15,
  // },
  // scrnBtns:{
  //     marginTop:30,
  //     marginBottom:10,
  //     gap:15
  // },
  nxtBtn: {
    backgroundColor: "#1a1b1a",
    marginTop: 10,
    padding: 2,
    marginHorizontal: 80,
    marginBottom: 10,
    alignItems: "center",
    borderRadius: 30,
  },
  nxtBtnIcon: {
    fontSize: 50,
    color: "#ffffff",
  },
  addressNxtBtn: {
    marginTop: "auto",
    marginBottom: 20,
    backgroundColor: "#1a1b1a",
    marginTop: 10,
    padding: 2,
    marginHorizontal: 80,
    marginBottom: 10,
    alignItems: "center",
    borderRadius: 30,
  },
  addressNxtBtnIcon: {
    fontSize: 50,
    color: "#ffffff",
  },
  signoutBtn: {
    position: "absolute",
    top: 10,
    right: 15,
  },
  signoutTxt: {
    fontSize: 16,
    color: "#c90707",
  },
  gContainer: {
    position: "relative",
    height: "8%",
    zIndex: 2,
    marginVertical: 10,
  },
  clearIconContainer: {
    position: "absolute",
    right: 10,
    top: 20,
    zIndex: 3,
  },
  clearIcon: {
    fontSize: 25,
    color: "grey",
  },
  gContainerFocused: {
    height: "40%", // Set the desired height when typing
    zIndex: 2,
  },
  gTextInputContainer: {
    // paddingLeft:10,
    // paddingRight:10,
  },
  gTextInput: {
    height: 60,
  },

  gPoweredContainer: {
    display: "none",
  },

  // Review styles
  subHeader: {
    marginTop: 15,
    fontSize: 15,
    fontWeight: "bold",
  },
  inputReview: {
    padding: 5,
    fontSize: 18,
    letterSpacing: 0.5,
    color: "white",
    backgroundColor: "#3b3b3b",
    borderRadius: 20,
  },
  inputReviewLast: {
    padding: 5,
    fontSize: 18,
    letterSpacing: 0.5,
    color: "white",
    backgroundColor: "#3b3b3b",
    borderRadius: 20,
    marginBottom: 20,
  },

  saveBtn: {
    backgroundColor: "#05c405",
    marginTop: 10,
    padding: 2,
    marginHorizontal: 60,
    marginBottom: 10,
    alignItems: "center",
    borderRadius: 30,
  },
  saveBtnTxt: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#e9e6e6",
  },
});

export default styles;
