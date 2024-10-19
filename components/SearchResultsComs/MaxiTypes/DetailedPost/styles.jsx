import { StyleSheet, Dimensions} from 'react-native'

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    container:{
        flex:1,
        marginTop:40,
    },
    title: {
        fontSize: 30,
        fontWeight: "bold",
        textAlign: "center",
        margin: 10,
    },
    imgConatiner:{
        aspectRatio:3/2,
        width:width,
        borderRadius:20,
        overflow:'hidden',
    },
    img:{
        height:'100%',
        width:'100%',
        objectFit:'contain',
    },
    scrollSec:{
        marginHorizontal:10,
    },
    subHeading:{
        fontSize:19,
        fontWeight:'bold',
    },
    detail:{
        padding:10,
        fontSize:18,
        color:'white',
        backgroundColor:'#464545',
        borderRadius:10,
        marginBottom:10,
    },
})

export default styles;
