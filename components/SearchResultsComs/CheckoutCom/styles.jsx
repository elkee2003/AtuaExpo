import { StyleSheet, } from 'react-native'

const styles = StyleSheet.create({
    container:{
        flex:1,
        marginTop:40,
        marginHorizontal:10,
    },
    title:{
        fontSize: 30,
        fontWeight: "bold",
        textAlign: "center",
        margin: 10,
    },
    txtRow:{
        marginBottom:20,
    },

    txtTitle:{
        color:'#0e0d0dd9',
        fontSize:22,
        fontWeight:'bold',
        marginLeft:10,
        marginBottom:5
    },
    txt:{
        color:'#f1efef',
        padding:7,
        backgroundColor:'#0e0d0dd9',
        borderRadius:25,
        fontSize:19,
    },
    btnContainer:{
        marginHorizontal:80,
        padding:5,
        borderRadius:20,
        backgroundColor:'#09d809',
        justifyContent:'center',
        alignItems:'center',
        marginBottom:10,
    },
    btnTxt:{
        fontSize:30,
        fontWeight:'bold'
    }
})

export default styles
